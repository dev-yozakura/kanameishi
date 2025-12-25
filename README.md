# 要石 kanameishi

## 简介
要石(kanameishi)是一个基于多重API制作的地震预警和地震信息可视化Web应用，基于Vite+Vue3+Leaflet开发。  
提供基于Tauri构建的Windows及macOS应用程序，推荐Windows 10、macOS 11及以上系统使用。  
icon是《铃芽之旅》的草太さん（椅子形态）。  
* [Web版](https://kanameishi.lipomoea.tech/)
* [Web版备用](https://kanameishi.pages.dev/)（使用CloudFlare托管，速度更快，但国内可能需要代理访问。）
* [应用程序下载](https://github.com/Lipomoea/kanameishi/releases)
* [应用程序下载（备用）](https://gitee.com/lipomoea/kanameishi/releases)

## Android（PWA）
本仓库已加入 PWA 支持，可在 Android 上“安装到主屏幕”作为应用使用：
* 用 Chrome 打开 Web 版
* 浏览器菜单 → “添加到主屏幕”（或“安装应用”）

> 说明：PWA 通过 Service Worker 缓存资源，若更新后仍显示旧版本，可在浏览器中清除站点数据/缓存后重试。

### 开发者：如何以 PWA 方式验证（Android）
PWA 的前提是 **安全上下文**（HTTPS 或 localhost）。因此：
* 已部署到 HTTPS 的站点：直接用 Android Chrome 打开并“安装应用”。
* 本地开发机：推荐用 **ADB 反向端口** 在手机上访问 `http://localhost`（依然满足 localhost 规则）。

#### 方式 A：部署到 HTTPS（最简单）
* 将 `dist/` 部署到任意 HTTPS 静态托管（例如 Cloudflare Pages / GitHub Pages 等）
* Android Chrome 打开站点 → 菜单 → “安装应用/添加到主屏幕”

#### 方式 B：本地 + ADB（无需折腾 HTTPS 证书）
1) 构建并在本机启动预览：
* `pnpm install`
* `pnpm build`
* `pnpm preview`

2) 手机开启“USB 调试”，连接到电脑后执行：
* `adb reverse tcp:4173 tcp:4173`

3) 在手机 Chrome 打开：
* `http://localhost:4173/`
然后在菜单里选择“安装应用/添加到主屏幕”。

#### 方式 C：同一局域网访问（需要 HTTPS）
如果要在手机上直接访问电脑 IP（例如 `http://192.168.x.x:4173`），由于不是 localhost，Service Worker 通常不会在 HTTP 下工作。
* 仅用于页面查看：`pnpm preview:host` 后用手机访问即可。
* 需要完整 PWA（SW/离线缓存/安装）：请改用 HTTPS（自签证书/反代/隧道）或使用“方式 B”。

## 主要功能  
* 接收日本气象厅、台湾省中央气象署、中国地震局（包括各省分局）、四川省地震局、福建省地震局地震预警信息。
* 接收日本气象厅、中国地震台网地震信息。
* 接收日本气象厅海啸情报。
* 获取NIED強震モニタ测站数据。
## 注意事项
* 使用本网页前，请详细阅读网页“设置”-“帮助&关于”中的内容。
## 数据来源
* 地震预警（JMA/CWA/CEA/SC/FJ）、地震信息（CENC）、地震列表（JMA）、IP定位：[Wolfx Open API](https://wolfx.jp/apidoc)（请注意参考接口文档）
* 地震信息（JMA）、海啸信息（JMA）：[P2PQuake](https://www.p2pquake.net/develop/json_api_v2/#/P2P%E5%9C%B0%E9%9C%87%E6%83%85%E5%A0%B1%20API/get_history)
* 地震预警（CEA/SC/FJ）、地震信息（CENC/USGS/FSSN）、地震列表（CENC/FSSN）、NTP时间：[FAN Studio API](https://api.fanstudio.tech/doc/wsapi/)
* 中国大陆地图：[阿里云DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)
* 中国台湾地图：[GeoJSON](https://geojson.cn/)
* 中国断层：[国家地震科学数据中心](https://data.earthquake.cn/datashare/report.shtml?PAGEID=datasourcelist&dt=ff808082845b8fd401845bf036a1000c)
* 中国地图注记：[中国城市经纬度坐标点集](https://gitcode.com/Open-source-documentation-tutorial/a0d83)
* 日本地图：[日本気象庁](https://www.data.jma.go.jp/developer/gis.html)（注意钓鱼岛地区处理）
* 世界地图：[GeoJSON Maps of the globe](https://geojson-maps.kyd.au/)（注意甄别争议地区）
* 地震計リアルタイム（SeedLink）：[IRIS DMC SeedLink Service](https://ds.iris.edu/ds/nodes/dmc/services/seedlink/)
* SREV音效：[scratch-realtime-earthquake-viewer-page](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)
* 中文倒计时播报素材：[地牛Wake Up！](https://eew.earthquake.tw/)
## 参考软件
* [JQuake](https://jquake.net/)
* [scratch-realtime-earthquake-viewer-page](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)
* [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)
## 特别鸣谢
* [Wolfx Project](https://wolfx.jp/)
* [TBS](https://space.bilibili.com/652050915/)
* [FAN](https://www.fanstudio.tech/)
* Dxr (QQ: 2194362576)
* HomoOS
* [azzbm](https://space.bilibili.com/702013828)
* [不知道要取什么系列](https://space.bilibili.com/499911115)
* [Andyli](https://space.bilibili.com/401770455)
* 各位提供帮助的EEW爱好者
## 版权声明
本项目参考了以下项目的源代码。
* [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)
* [TREM-tauri](https://github.com/ExpTechTW/TREM-tauri)
* [EarthQuakeWarning](https://github.com/kengwang/EarthQuakeWarning)
* [Zero-Quake](https://github.com/0Quake/Zero-Quake)
## 开放源代码许可
本项目基于[AGPL-3.0](https://github.com/Lipomoea/kanameishi/blob/main/LICENSE)协议授权。
