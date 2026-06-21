import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_travel.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"

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

        exported = client.get("/api/export")
        assert exported.status_code == 200
        payload = exported.json()
        assert payload["schema_version"] == 1

        assert client.delete("/api/reset").status_code == 204
        assert client.get("/api/places").json() == []
        assert client.get("/api/trip").json()["name"] == "我的旅行"

        imported = client.post("/api/import", json=payload)
        assert imported.status_code == 200, imported.text
        assert len(client.get("/api/places").json()) == len(payload["places"])


def test_not_found_and_validation():
    with TestClient(app) as client:
        assert client.delete("/api/itinerary/999999").status_code == 404
        trip = client.get("/api/trip").json()
        trip["end_date"] = "2020-01-01"
        assert client.put("/api/trip", json={k:v for k,v in trip.items() if k != "id"}).status_code == 422


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


def teardown_module():
    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink()
