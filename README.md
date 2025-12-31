# 要石（kanameishi）

## 概要
要石（kanameishi）は、複数の API を組み合わせて地震警報（EEW）や地震情報を可視化する Web アプリです。Vite + Vue 3 + Leaflet で開発されています。

Tauri による Windows / macOS アプリも提供しています（Windows 10 / macOS 11 以上推奨）。

アイコンは『すずめの戸締まり』の草太さん（椅子形態）をモチーフにしています。

## リンク
- Web版: https://kanameishi.lipomoea.tech/
- Web版（予備）: https://kanameishi.pages.dev/（Cloudflare ホスティング。環境によってはアクセスにプロキシが必要な場合があります）
- アプリ版（Releases）: https://github.com/Lipomoea/kanameishi/releases
- アプリ版（予備）: https://gitee.com/lipomoea/kanameishi/releases

## 主な機能
- 地震警報（EEW）の受信・表示
	- 日本気象庁（JMA）
	- 台湾中央気象署（CWA）
	- 中国地震局（CEA：省級ソース含む）
	- 四川省地震局（SC）
	- 福建省地震局（FJ）
- 地震情報の受信・表示
	- 日本気象庁（JMA）
	- 中国地震台ネットワーク（CENC）
- 津波情報の受信・表示（日本気象庁）
- 観測網データの表示（例: NIED 強震モニタ）

## 重要：利用前の注意
利用前に、アプリ内の「設定」→「ヘルプ&About」の注意事項を必ず確認してください。

## Android（PWA）
本リポジトリは PWA に対応しており、Android では「ホーム画面に追加（アプリとしてインストール）」して利用できます。

手順:
- Android の Chrome で Web 版を開く
- ブラウザメニュー →「ホーム画面に追加」または「アプリをインストール」

補足:
- PWA は Service Worker によるキャッシュを使用します。更新後も古い表示が残る場合、サイトデータ/キャッシュを削除して再試行してください。

## GitHub Pages で一部データが表示できない場合（重要）
GitHub Pages は「静的ホスティング」のため、開発時に使っている Vite の `server.proxy`（例: `/kmoni`, `/palert`, `/msil`）が使えません。
また、外部サイトの多くは CORS 制限や Origin/Referer チェックがあるため、ブラウザから直接取得できない場合があります。

対策として、外部にリバースプロキシ（Edge Proxy）を用意し、ビルド時に `VITE_EDGE_PROXY_BASE` を設定してください。

- Proxy 実装例（Cloudflare Workers 向け）: [tools/edge-proxy/worker.mjs](tools/edge-proxy/worker.mjs)
- GitHub Actions での設定例:
	- リポジトリ Settings → Secrets and variables → Actions → Variables に `VITE_EDGE_PROXY_BASE` を追加
	- 例: `https://your-worker.your-account.workers.dev`

この設定がない場合、環境によっては NIED(kmoni), P-Alert, 海しる(MSIL) などが表示できないことがあります。

## 任意：GlobalQuake (Yuzhno) SSE テスト
`http://localhost:8788/gq/yuzhno/stream` への SSE 接続は、プロキシが停止しているとブラウザが自動再接続を繰り返し、コンソールに `net::ERR_CONNECTION_REFUSED` が大量に出ることがあります。

このためデフォルトでは無効です。必要な場合のみ、環境変数で明示的に有効化してください。

- `VITE_GQ_YUZHNO_SSE_URL=http://localhost:8788/gq/yuzhno/stream`

## 開発者向け：PWA として検証（Android）
PWA は「セキュアコンテキスト」（HTTPS または localhost）が前提です。

### 方法A：HTTPS にデプロイ（最も簡単）
- `dist/` を任意の HTTPS 静的ホスティング（Cloudflare Pages / GitHub Pages 等）へ配置
- Android Chrome で開き、メニューから「アプリをインストール/ホーム画面に追加」

### 方法B：ローカル + ADB（HTTPS 証明書が不要）
1) ビルドしてプレビュー起動:
- `pnpm install`
- `pnpm build`
- `pnpm preview`

2) 端末で USB デバッグを有効にして PC に接続し、次を実行:
- `adb reverse tcp:4173 tcp:4173`

3) 端末の Chrome で次を開く:
- `http://localhost:4173/`

### 方法C：同一 LAN からアクセス（HTTPS が必要）
PC の IP（例: `http://192.168.x.x:4173`）に HTTP で直接アクセスする場合、localhost ではないため Service Worker が動作しないことが一般的です。

- ページ表示だけでよければ `pnpm preview:host` でアクセス可能
- PWA（SW/オフラインキャッシュ/インストール）まで検証する場合は HTTPS を用意するか、方法Bを利用してください

## データソース（取得元）
- 地震警報（JMA/CWA/CEA/SC/FJ）、地震情報（CENC）、地震一覧（JMA）、IP 位置推定: [Wolfx Open API](https://wolfx.jp/apidoc)
- 地震情報（JMA）、津波情報（JMA）: [P2PQuake JSON API v2](https://www.p2pquake.net/develop/json_api_v2/#/P2P%E5%9C%B0%E9%9C%87%E6%83%85%E5%A0%B1%20API/get_history)
- 地震警報（CEA/SC/FJ）、地震情報（CENC/USGS/FSSN）、地震一覧（CENC/FSSN）、NTP 時刻: [FAN Studio API](https://api.fanstudio.tech/doc/wsapi/)

### 地図データ
- 中国大陸: [阿里云 DataV.GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)
- 台湾: [GeoJSON](https://geojson.cn/)
- 中国断層: [国家地震科学数据中心](https://data.earthquake.cn/datashare/report.shtml?PAGEID=datasourcelist&dt=ff808082845b8fd401845bf036a1000c)
- 中国の地名注記: [中国城市经纬度坐标点集](https://gitcode.com/Open-source-documentation-tutorial/a0d83)
- 日本: [日本気象庁 GIS](https://www.data.jma.go.jp/developer/gis.html)
- 世界: [GeoJSON Maps of the globe](https://geojson-maps.kyd.au/)（境界線/係争地等は各自でご確認ください）

### 観測データ
- 地震計リアルタイム（SeedLink）: [IRIS DMC SeedLink Service](https://ds.iris.edu/ds/nodes/dmc/services/seedlink/)

### 音声素材
- SREV 効果音: [scratch-realtime-earthquake-viewer-page](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)
- 中国語カウントダウン音声素材: [地牛 Wake Up！](https://eew.earthquake.tw/)

## 参考ソフト
- [JQuake](https://jquake.net/)
- [scratch-realtime-earthquake-viewer-page](https://github.com/kotoho7/scratch-realtime-earthquake-viewer-page)
- [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)

## 謝辞
- [Wolfx Project](https://wolfx.jp/)
- [TBS](https://space.bilibili.com/652050915/)
- [FAN](https://www.fanstudio.tech/)
- Dxr（QQ: 2194362576）
- HomoOS
- [azzbm](https://space.bilibili.com/702013828)
- [不知道要取什么系列](https://space.bilibili.com/499911115)
- [Andyli](https://space.bilibili.com/401770455)
- そのほか支援いただいた EEW コミュニティの皆さま

## 著作権・参考実装について
本プロジェクトは、以下のプロジェクトの実装を参考にしています。

- [TREM-Lite](https://github.com/ExpTechTW/TREM-Lite)
- [TREM-tauri](https://github.com/ExpTechTW/TREM-tauri)
- [EarthQuakeWarning](https://github.com/kengwang/EarthQuakeWarning)
- [Zero-Quake](https://github.com/0Quake/Zero-Quake)

## ライセンス
本プロジェクトは [AGPL-3.0](LICENSE) で提供されています。
