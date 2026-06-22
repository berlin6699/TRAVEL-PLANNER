# TRAVEL-PLANNER Android App

“旅途”Android 客户端，面向红米及其他 Android 7+ 手机。App 基于 Capacitor 8、React、TypeScript 与 IndexedDB，数据完全保存在手机本地，不依赖电脑、Docker 或云端服务器。

## 已支持

- 多旅程、国家 / 地区、城市管理
- 城市日程、预约与 PDF 车票
- 灵感、地点、路线、记账和行前清单
- 离线使用与本地持久化
- 导入电脑端导出的完整 ZIP / JSON 备份
- 导出包含 PDF 的完整 ZIP，并通过 Android 分享面板保存
- 原生打开 PDF 附件
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

仓库内最新版安装包：`releases/TravelPlanner-v1.4-debug.apk`。

## 从电脑端迁移数据

1. 在电脑端“设置”中选择“导出完整备份 ZIP”。
2. 把 ZIP 发送到手机。
3. 在 Android App 的“设置”中选择“导入备份恢复”。
4. 选择 ZIP，旅程数据和预约 PDF 会一起恢复到手机本地。

> App 与电脑端目前采用备份互导，不进行云端实时同步。
