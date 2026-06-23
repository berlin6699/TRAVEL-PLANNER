# Travel Planner / 旅途

统一维护网页端和多端 App 的旅行规划项目。两个客户端采用相同的旅行数据结构，支持多旅程、城市日程、预约与票据、路线、灵感、记账、行李清单、可复用模板和公开攻略 PDF。

## 项目结构

```text
TRAVEL-PLANNER/
├─ app/                   Android / iPhone / macOS / Windows App
│  ├─ android/            Capacitor Android 原生工程
│  ├─ ios/                Capacitor iOS 原生工程
│  ├─ desktop/            Electron 桌面端入口
│  ├─ src/                React + TypeScript 客户端
│  ├─ releases/           可直接安装的 APK
│  └─ README.md           App 开发与构建说明
├─ web/                   网页端
│  ├─ frontend/           React + Vite + TypeScript
│  ├─ backend/            FastAPI + SQLite
│  ├─ compose.yaml        Docker Compose 配置
│  └─ README.md           网页端部署与开发说明
└─ README.md
```

## 多端 App

App 的数据完全保存在当前设备本地，可离线使用，不依赖 Docker 或网页后端。macOS / Windows 桌面版可以在“设置”中查看并打开本机数据保存路径。

```bash
cd app
npm install
npm test
npm run build
npm run android:apk
npm run ios:sync
npm run desktop:mac
npm run desktop:win
```

最新版安装包集中放在 GitHub Release：[`app-v1.5.1`](https://github.com/berlin6699/TRAVEL-PLANNER/releases/tag/app-v1.5.1)，包含 Android APK、macOS DMG / ZIP 和 Windows 10 x64 EXE / ZIP。

更多说明见 [`app/README.md`](app/README.md)。

## 网页端

使用 Docker 启动完整网页端：

```bash
cd web
docker compose up --build -d
```

默认访问地址：`http://localhost:8080`。

也可以分别启动 FastAPI 后端和 Vite 前端，详见 [`web/README.md`](web/README.md)。

## App 与网页端迁移数据

目前两个客户端采用 ZIP / JSON 备份互导，不进行云端实时同步：

1. 在一个客户端的“设置”中导出完整备份 ZIP。
2. 把 ZIP 传到另一台设备。
3. 在另一个客户端选择“导入备份恢复”。
4. 旅程数据和预约 PDF 会一起恢复。

## 仓库说明

本仓库已合并原 `TRAVEL-PLANNER-Android-APP` 的完整 Git 历史。今后的 App 与网页端更新都在本仓库进行，旧 Android 仓库仅作为迁移前的历史入口保留。
