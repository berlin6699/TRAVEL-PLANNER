import os
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

from pypdf import PdfReader, PdfWriter

TEST_DB = Path(__file__).parent / "test_travel.db"
TEST_UPLOADS = Path(__file__).parent / "test_uploads"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["UPLOAD_DIR"] = str(TEST_UPLOADS)

from fastapi.testclient import TestClient

from main import app
from database import engine


def test_full_api_flow():
    with TestClient(app) as client:
        trip = client.get("/api/trip")
        assert trip.status_code == 200
        assert trip.json()["name"] == "日本关西 · 东京 8 日游"
        cities = client.get("/api/cities").json()
        assert [city["name"] for city in cities] == ["京都", "东京"]
        routes = client.get("/api/route-legs").json()
        assert len(routes) == 3
        assert "火车" in routes[1]["transport_modes"]
        route_payload = {key: value for key, value in routes[1].items() if key != "id"}
        route_payload["selected_mode"] = "大巴"
        changed_route = client.put(f"/api/route-legs/{routes[1]['id']}", json=route_payload)
        assert changed_route.status_code == 200
        assert changed_route.json()["selected_mode"] == "大巴"

        created = client.post("/api/places", json={
            "name": "测试咖啡店", "type": "餐厅", "city": "东京", "address": "银座",
            "map_url": "https://maps.google.com", "note": None, "image_url": None,
        })
        assert created.status_code == 201
        place_id = created.json()["id"]
        assert any(x["id"] == place_id for x in client.get("/api/places?type=餐厅").json())

        invalid = client.post("/api/expenses", json={
            "title": "错误金额", "amount": 0, "currency": "EUR", "date": "2026-01-01", "category": "餐饮",
            "payment_method": None, "note": None, "is_split": False, "itinerary_id": None,
            "reservation_id": None,
        })
        assert invalid.status_code == 422

        foreign_expense = client.post("/api/expenses", json={
            "title": "伦敦地铁", "amount": 12.5, "currency": "GBP", "date": "2026-01-01",
            "category": "交通", "payment_method": "信用卡", "note": None, "is_split": False,
            "itinerary_id": None, "reservation_id": None,
        })
        assert foreign_expense.status_code == 201
        assert foreign_expense.json()["currency"] == "GBP"

        writer = PdfWriter()
        writer.add_blank_page(width=300, height=200)
        pdf_buffer = BytesIO()
        writer.write(pdf_buffer)
        reservation_id = client.get("/api/reservations").json()[0]["id"]
        attachment = client.post(
            f"/api/reservations/{reservation_id}/attachments",
            files={"file": ("train-ticket.pdf", pdf_buffer.getvalue(), "application/pdf")},
        )
        assert attachment.status_code == 201
        attachment_id = attachment.json()["id"]
        assert attachment.json()["original_name"] == "train-ticket.pdf"
        assert len(client.get(f"/api/reservation-attachments?reservation_id={reservation_id}").json()) == 1
        opened = client.get(f"/api/reservation-attachments/{attachment_id}/file")
        assert opened.status_code == 200
        assert opened.content.startswith(b"%PDF-")
        archive_response = client.get("/api/export/archive")
        assert archive_response.status_code == 200
        archive_bytes = archive_response.content
        with ZipFile(BytesIO(archive_bytes)) as backup:
            assert "travel-planner.json" in backup.namelist()
            manifest = json.loads(backup.read("travel-planner.json"))
            assert len(manifest["reservation_attachments"]) == 1
            archived_pdf = backup.read(manifest["reservation_attachments"][0]["archive_path"])
            assert len(PdfReader(BytesIO(archived_pdf)).pages) == 1
        invalid_pdf = client.post(
            f"/api/reservations/{reservation_id}/attachments",
            files={"file": ("fake.pdf", b"not-a-pdf", "application/pdf")},
        )
        assert invalid_pdf.status_code == 400
        assert client.delete(f"/api/reservation-attachments/{attachment_id}").status_code == 204

        exported = client.get("/api/export")
        assert exported.status_code == 200
        payload = exported.json()
        assert payload["schema_version"] == 1
        itinerary_item = payload["itinerary"][0]
        reservation_ids = [item["id"] for item in payload["reservations"][:2]]
        inspiration_id = payload["inspirations"][0]["id"]
        itinerary_item["reservation_ids"] = reservation_ids
        itinerary_item["reservation_id"] = reservation_ids[0]
        itinerary_item["inspiration_id"] = inspiration_id
        itinerary_item["reminder_minutes"] = 30
        updated_itinerary = client.put(
            f"/api/itinerary/{itinerary_item['id']}",
            json={key: value for key, value in itinerary_item.items() if key != "id"},
        )
        assert updated_itinerary.status_code == 200, updated_itinerary.text
        payload = client.get("/api/export").json()

        assert client.delete("/api/reset").status_code == 204
        assert client.get("/api/places").json() == []
        assert client.get("/api/trip").json()["name"] == "我的旅行"

        imported = client.post("/api/import", json=payload)
        assert imported.status_code == 200, imported.text
        assert len(client.get("/api/places").json()) == len(payload["places"])
        restored_item = client.get("/api/itinerary").json()[0]
        assert restored_item["reservation_ids"] == reservation_ids
        assert restored_item["inspiration_id"] == inspiration_id
        assert restored_item["reminder_minutes"] == 30
        assert client.get("/api/reservation-attachments").json() == []

        restored = client.post(
            "/api/import/archive",
            files={"file": ("travel-planner-full.zip", archive_bytes, "application/zip")},
        )
        assert restored.status_code == 200, restored.text
        assert restored.json()["counts"]["attachments"] == 1
        restored_attachments = client.get("/api/reservation-attachments").json()
        assert len(restored_attachments) == 1
        restored_pdf = client.get(f"/api/reservation-attachments/{restored_attachments[0]['id']}/file")
        assert len(PdfReader(BytesIO(restored_pdf.content)).pages) == 1
        assert client.delete(f"/api/reservation-attachments/{restored_attachments[0]['id']}").status_code == 204


def test_not_found_and_validation():
    with TestClient(app) as client:
        assert client.delete("/api/itinerary/999999").status_code == 404
        itinerary_item = client.get("/api/itinerary").json()[0]
        itinerary_item["reminder_minutes"] = 10081
        assert client.put(
            f"/api/itinerary/{itinerary_item['id']}",
            json={key: value for key, value in itinerary_item.items() if key != "id"},
        ).status_code == 422
        trip = client.get("/api/trip").json()
        trip["end_date"] = "2020-01-01"
        assert client.put("/api/trip", json={k:v for k,v in trip.items() if k != "id"}).status_code == 422


def test_checklist_crud_and_geocode(monkeypatch):
    async def fake_geocode(query: str, limit: int):
        assert query == "巴黎"
        assert limit == 5
        return [{"name": "Paris", "display_name": "Paris, Île-de-France, France", "latitude": 48.8566, "longitude": 2.3522, "result_type": "city"}]

    monkeypatch.setattr("main.fetch_geocode", fake_geocode)
    with TestClient(app) as client:
        trip_id = client.get("/api/trip").json()["id"]
        created = client.post("/api/checklist", json={
            "trip_id": trip_id, "kind": "待办", "title": "核对护照", "category": "证件",
            "quantity": 1, "completed": False, "due_date": "2026-06-20", "note": None, "order_index": 0,
        })
        assert created.status_code == 201
        item = created.json()
        item["completed"] = True
        updated = client.put(f"/api/checklist/{item['id']}", json={key:value for key,value in item.items() if key != "id"})
        assert updated.status_code == 200
        assert updated.json()["completed"] is True
        assert len(client.get(f"/api/checklist?trip_id={trip_id}&kind=待办").json()) == 1
        geocoded = client.get("/api/geocode", params={"q": "巴黎"})
        assert geocoded.status_code == 200
        assert geocoded.json()[0]["latitude"] == 48.8566
        assert client.delete(f"/api/checklist/{item['id']}").status_code == 204


def test_multiple_trips_are_isolated_and_cascade():
    with TestClient(app) as client:
        first_trip = client.get("/api/trips").json()[0]
        second = client.post("/api/trips", json={
            "name": "欧洲双国旅行", "start_date": "2027-05-01", "end_date": "2027-05-12",
            "total_budget": 30000, "currency": "CNY",
        })
        assert second.status_code == 201
        second_id = second.json()["id"]
        destination = client.post("/api/destinations", json={
            "trip_id": second_id, "name": "法国", "type": "国家", "code": "FR",
            "order_index": 0, "parent_id": None, "note": None,
        })
        assert destination.status_code == 201
        city = client.post("/api/cities", json={
            "trip_id": second_id, "destination_id": destination.json()["id"], "name": "巴黎",
            "country": "法国", "order_index": 0, "arrival_date": "2027-05-01",
            "departure_date": "2027-05-05", "latitude": 48.8566, "longitude": 2.3522, "note": None,
        })
        assert city.status_code == 201
        place = client.post("/api/places", json={
            "trip_id": second_id, "city_id": city.json()["id"], "name": "卢浮宫", "type": "景点",
            "city": "巴黎", "address": None, "map_url": None, "note": None, "image_url": None,
            "latitude": 48.8606, "longitude": 2.3376,
        })
        assert place.status_code == 201
        assert len(client.get(f"/api/places?trip_id={second_id}").json()) == 1
        assert all(item["trip_id"] == first_trip["id"] for item in client.get(f"/api/places?trip_id={first_trip['id']}").json())
        assert client.delete(f"/api/trips/{second_id}").status_code == 204
        assert client.get(f"/api/places?trip_id={second_id}").json() == []
        assert client.get(f"/api/destinations?trip_id={second_id}").json() == []


def test_archive_restore_rolls_back_when_attachment_write_fails(monkeypatch):
    with TestClient(app) as client:
        before = client.get("/api/export").json()
        reservation_id = before["reservations"][0]["id"]
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=200)
        pdf_buffer = BytesIO()
        writer.write(pdf_buffer)
        before["reservation_attachments"] = [{
            "id": 9999,
            "reservation_id": reservation_id,
            "original_name": "rollback.pdf",
            "mime_type": "application/pdf",
            "size_bytes": len(pdf_buffer.getvalue()),
            "uploaded_at": "2026-01-01T00:00:00",
            "archive_path": "attachments/rollback.pdf",
        }]
        archive_buffer = BytesIO()
        with ZipFile(archive_buffer, "w") as archive:
            archive.writestr("travel-planner.json", json.dumps(before, ensure_ascii=False))
            archive.writestr("attachments/rollback.pdf", pdf_buffer.getvalue())

        original_replace = Path.replace

        def fail_staged_pdf(self, target):
            if self.name.endswith(".pdf"):
                raise OSError("simulated disk failure")
            return original_replace(self, target)

        monkeypatch.setattr(Path, "replace", fail_staged_pdf)
        failed = client.post(
            "/api/import/archive",
            files={"file": ("rollback.zip", archive_buffer.getvalue(), "application/zip")},
        )
        assert failed.status_code == 500
        after = client.get("/api/export").json()
        assert [trip["name"] for trip in after["trips"]] == [trip["name"] for trip in before["trips"]]
        assert len(after["itinerary"]) == len(before["itinerary"])
        assert client.get("/api/reservation-attachments/9999/file").status_code == 404


def teardown_module():
    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink()
    if TEST_UPLOADS.exists():
        for file in TEST_UPLOADS.iterdir():
            file.unlink()
        TEST_UPLOADS.rmdir()
