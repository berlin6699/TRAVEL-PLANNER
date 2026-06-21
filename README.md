# Travel Planner / 旅途

一个完全在本地运行的旅行行程管理网页端。它可以管理日程、预约、攻略灵感、地点、消费、行李清单、待办与旅行预算，所有数据都保存在本机 SQLite 数据库中。

- 每笔消费可记录人民币、美元、欧元、英镑等原币金额和折算汇率；预算与总支出统一按人民币汇总。
- 日程、预约和地点中的地图可在当前页面弹窗预览，同时保留外部地图链接作为兼容兜底。
- 支持创建和切换多个独立旅程；每个旅程按“国家 / 地区 → 城市 → 地点 / 日程 / 预约”组织。
- 城市与路线页使用 OpenStreetMap 交互底图标出地点相对位置；路线支持步行、公交、驾车、火车、大巴、飞机等方案，并可关联自己的交通预约。
- 新增城市或地点时可搜索 OpenStreetMap 地名并从候选结果中确认坐标；断网时仍可手动填写或留空。
- 预约可上传多个车票、景点门票或确认单 PDF；文件经过格式与大小校验后保存在本地持久化存储中。
- 行前清单分为行李和待办，可记录分类、数量、截止日期并勾选完成状态。

## 使用 Docker 启动（推荐）

需要安装并启动 Docker Desktop。在项目根目录执行：

```powershell
docker compose up --build -d
```

启动完成后访问 `http://localhost:8080`；如果根目录 `.env` 覆盖了端口，则使用其中的 `TRAVEL_PLANNER_PORT`。当前工作区因本机端口冲突已配置为 `http://localhost:8088`。网页和 API 由同一个地址提供，Nginx 会把 `/api` 请求转发给 FastAPI 容器。

常用管理命令：

```powershell
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 停止服务（保留数据）
docker compose down

# 再次启动
docker compose up -d
```

SQLite 数据保存在名为 `travel-planner-data` 的 Docker 卷中。`docker compose down`、更新镜像或重建容器都不会删除它。只有明确执行下面的命令才会连同数据库一起删除：

预约 PDF 位于同一个 Docker 卷的 `/data/uploads`。设置页导出的完整 ZIP 同时包含 `travel-planner.json` 和全部 PDF，可直接导入恢复；旧版纯 JSON 仍可导入，但不包含 PDF。

```powershell
docker compose down -v
```

默认网页端口为 `8080`。需要更改时，把 `.env.example` 复制为 `.env` 并修改 `TRAVEL_PLANNER_PORT`，或者临时执行：

```powershell
$env:TRAVEL_PLANNER_PORT="3000"
docker compose up -d
```

## 项目结构

```text
旅行APP/
├─ frontend/              React + Vite + TypeScript + Tailwind CSS
│  └─ src/
│     ├─ api/             REST API 客户端
│     ├─ components/      布局、弹窗、表单和基础 UI
│     ├─ hooks/           数据加载 Hook
│     ├─ pages/           首页、日程、预约、灵感、地图、清单、记账与设置页面
│     └─ types/           TypeScript 数据类型
├─ backend/               FastAPI + SQLAlchemy
│  ├─ main.py             API 入口
│  ├─ models.py           SQLite 数据模型
│  ├─ schemas.py          请求、响应与校验模型
│  ├─ seed.py             首次启动演示数据
│  └─ tests/              API 自动化测试
└─ README.md
```

## 启动后端

需要 Python 3.11 或更高版本。

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

macOS / Linux 激活环境使用：

```bash
source .venv/bin/activate
```

后端地址为 `http://localhost:8000`，交互式 API 文档位于 `http://localhost:8000/docs`。

## 启动前端

另开一个终端：

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。如需修改 API 地址，启动前设置 `VITE_API_BASE_URL`，值需要包含 `/api`。

## 数据库与示例数据

数据库文件在 `backend/travel_planner.db`。首次启动后端时会自动建表，并生成一趟约 30 天后开始的京都 / 东京 8 日演示旅行。清空数据库后会保留一条空白旅行设置，重启不会再次灌入演示数据。

不要在后端运行期间手动修改 SQLite 文件。要迁移或备份数据，请使用设置页的 JSON 功能。

## 导入、导出与清空

- 设置页点击“导出完整备份 ZIP”，浏览器会下载旅程数据及全部预约 PDF。
- 点击“导入备份恢复”可选择完整 ZIP 或旧版 JSON。ZIP 会校验路径、体积、数据关联及每个 PDF 后再恢复。
- “清空本地数据库”需要连续确认两次，随后删除全部业务记录并保留空白旅行设置。

## 测试与构建

```powershell
cd backend
pytest

cd ..\frontend
npm test
npm run build
```

## 后续扩展 iOS App

后端 REST API 与网页端解耦，未来 Swift / SwiftUI 客户端可以直接复用 `/api/trip`、`/api/itinerary`、`/api/reservations`、`/api/inspirations`、`/api/places`、`/api/expenses`、`/api/checklist` 以及导入导出接口。届时主要新增：面向局域网或云端的部署方式、HTTPS、用户认证和 iOS 网络层；现有业务数据结构与 CRUD 语义可以继续使用。

多旅程客户端应优先使用 `/api/trips` 和 `/api/destinations`，并在其他列表接口中传入 `trip_id`，以保证不同旅程的数据相互隔离。
