# 安装包、Release 与 macOS 安装避坑

这份说明专门记录“旅途 Travel Planner”多端安装包的区别、macOS 提示“文件已损坏”的原因，以及本地构建产物应该如何收纳。

## 安装包怎么选

GitHub Release 里会同时出现多个平台的文件，优先选择下面这些：

| 文件名特征 | 用途 | 推荐程度 |
| --- | --- | --- |
| `TravelPlanner-v版本号-debug.apk` | Android 手机安装包，适合红米手机 | 推荐 |
| `TravelPlanner-Setup-v版本号-win-x64.exe` | Windows 10/11 x64 安装程序 | 推荐 |
| `TravelPlanner-v版本号-mac-arm64.dmg` | Apple Silicon Mac，比如 M1/M2/M3/M4 | 推荐 |
| `TravelPlanner-v版本号-mac-x64.dmg` | Intel Mac | 推荐 |
| `*.zip` | 压缩包形式的桌面端产物，一般用于备用或排查 | 普通用户不优先选 |
| `*.blockmap` | 自动更新用的差分元数据 | 不需要手动下载 |

如果不确定自己的 Mac 是哪种芯片：

- Apple 菜单 → 关于本机 → 芯片显示 Apple M 系列：选择 `mac-arm64.dmg`
- Apple 菜单 → 关于本机 → 处理器显示 Intel：选择 `mac-x64.dmg`

## 为什么 GitHub 下载的 Mac 包会提示“文件已损坏”

macOS 的“文件已损坏”很多时候不是真的文件坏了，而是 Gatekeeper 拦截未公证应用时的提示。

目前本项目的 macOS 包如果没有 Apple Developer ID 签名和 Apple notarization 公证，会有这些特点：

- 本地构建出的包通常可以在自己的电脑上打开；
- 从 GitHub Release、浏览器、网盘等渠道下载后，文件可能带有 `com.apple.quarantine` 隔离标记；
- 隔离标记叠加“未签名/未公证”，macOS 可能显示“文件已损坏，无法打开”；
- 这和 Electron 构建是否成功不是一回事。

临时处理方式：

```bash
xattr -dr com.apple.quarantine "/Applications/旅途 Travel Planner.app"
```

如果只是测试，也可以直接使用本地构建出来的 DMG：

```bash
cd app
npm run desktop:mac:arm64
open desktop-dist
```

## 如何永久解决 macOS 安装拦截

永久解决需要 Apple Developer 账号，并在 GitHub Actions 中配置签名和公证所需的 Secrets：

- `CSC_LINK`：Developer ID Application 证书导出的 `.p12`，再转成 Base64
- `CSC_KEY_PASSWORD`：`.p12` 的密码
- `APPLE_ID`：Apple ID 邮箱
- `APPLE_APP_SPECIFIC_PASSWORD`：Apple 账号的 App 专用密码
- `APPLE_TEAM_ID`：Apple Developer Team ID

不要把这些内容写进代码，也不要发到聊天里。配置到 GitHub 仓库的 Actions Secrets 后，再发布新版，macOS 安装包才能做到对普通用户更友好。

## 本地构建产物怎么整理

`app/desktop-dist/` 是本地构建输出目录，里面通常会有 DMG、EXE、ZIP、blockmap、解包后的 app 目录等文件。这个目录已经被 `.gitignore` 忽略，不应该直接提交到 Git 历史里。

建议规则：

1. 当前版本可安装文件放到 `app/desktop-dist/latest/`。
2. 旧版本安装包移动到 `app/desktop-dist/archive/日期-before-v当前版本/`。
3. Electron 解包后的调试目录放到 `app/desktop-dist/unpacked/`。
4. builder 调试文件放到 `app/desktop-dist/diagnostics/`。
5. 真正需要分享给别人安装的文件，上传到 GitHub Release。
6. 不要把大体积安装包直接提交到普通代码提交里，否则仓库会越来越臃肿。

可以运行：

```bash
cd app
npm run desktop:organize-artifacts
```

这个命令会把非当前版本的历史安装包归档起来，不会删除文件。
