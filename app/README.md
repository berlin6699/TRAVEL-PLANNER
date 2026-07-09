# Travel Planner App

“旅途”多端客户端，位于统一仓库的 `app/` 目录。它基于 Capacitor 8、Electron、React、TypeScript 与 IndexedDB，支持 Android、iPhone、macOS 和 Windows 10+。数据完全保存在当前设备本地，不依赖电脑、Docker 或云端服务器。

## 已支持

- 多旅程、国家 / 地区、城市管理
- 城市日程、预约与 PDF 车票
- 灵感、地点、路线、记账和行前清单
- 离线使用与本地持久化
- 导入电脑端导出的完整 ZIP / JSON 备份
- 导出包含 PDF 的完整 ZIP，并通过 Android 分享面板保存
- 原生打开 PDF 附件
- macOS / Windows 桌面安装包
- 桌面版“设置”页可查看、复制并打开本机数据保存路径
- iPhone 的 Capacitor iOS 工程
- 首页概览与待办卡片可直达对应日程、预约和支出页面
- 预约类型使用稳定的本地图标，并针对手机端优化触控反馈与页面动效
- 可跨旅程复用基础随身、洗漱、摄影、药品和出发前待办模板；添加前可逐项编辑
- 生成不包含预约号、附件、预算和支出的公开攻略 PDF
- 全新的自适应 Android 应用图标

## 开发

```bash
npm install
npm run dev
npm test
npm run build
```

## Android

需要 Node.js 22+、Android Studio 2025.2.1+ 和 Android SDK API 24+。

```bash
npm run android:sync
npm run android:open
```

生成调试 APK：

```bash
npm run android:apk
```

APK 输出位置：`android/app/build/outputs/apk/debug/app-debug.apk`。

上一套完整公开 Android APK、macOS 和 Windows 安装包集中放在 GitHub Release：[`app-v1.5.4`](https://github.com/berlin6699/TRAVEL-PLANNER/releases/tag/app-v1.5.4)。当前源码版本见本目录 [`package.json`](package.json)，可在本地重新构建最新安装包。

## iPhone

需要 macOS、完整 Xcode、Apple ID / 开发者签名配置。

```bash
npm run ios:sync
npm run ios:open
```

打开 Xcode 后选择你的 iPhone 设备，在 `Signing & Capabilities` 中选择 Team，然后点击 Run 安装到手机。当前仓库已经包含 `ios/` 工程；如果前端代码有更新，安装前先运行 `npm run ios:sync`。

## macOS / Windows 10

桌面版使用 Electron。macOS 和 Windows 10+ 的数据都会保存在本机用户数据目录，App 内“设置 → 本机数据位置”可以查看、复制并直接打开该目录。

常见路径：

- macOS：`~/Library/Application Support/Travel Planner`
- Windows：`%APPDATA%\Travel Planner`

生成 macOS 安装文件：

```bash
npm run desktop:mac
```

默认生成 Apple Silicon / arm64 版本；Intel Mac 可运行 `npm run desktop:mac:x64`。

生成 Windows 10 x64 安装文件：

```bash
npm run desktop:win
```

输出位置：`desktop-dist/`。默认只生成推荐安装包；该目录是本地构建产物，体积较大，不提交到 Git；需要分享安装包时上传到 GitHub Release。

如果 `desktop-dist/` 里历史 DMG、EXE、ZIP 混在一起，可以运行：

```bash
npm run desktop:organize-artifacts
```

这个命令会把当前版本安装包移动到 `desktop-dist/latest/`，旧版本安装包移动到 `desktop-dist/archive/`，解包调试目录移动到 `desktop-dist/unpacked/`，不会删除文件。安装包区别和 macOS 安装拦截说明见 [`../docs/release-artifacts-and-macos.md`](../docs/release-artifacts-and-macos.md)。

## 迁移数据

1. 在电脑端“设置”中选择“导出完整备份 ZIP”。
2. 把 ZIP 发送到另一台设备。
3. 在另一个 App 的“设置”中选择“导入备份恢复”。
4. 选择 ZIP，旅程数据和预约 PDF 会一起恢复到手机本地。

> App 与电脑端目前采用备份互导，不进行云端实时同步。
