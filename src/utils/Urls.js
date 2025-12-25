export const eqUrls = {
    niedLatest: 'http://www.kmoni.bosai.go.jp/webservice/server/pros/latest.json',
    jmaEew2_http: 'http://www.kmoni.bosai.go.jp/webservice/hypo/eew',
    jmaEqlist_http: 'https://api.p2pquake.net/v2/history?codes=551&limit=1',
    usgsEqlist_http: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    wolfx_ws: 'wss://ws-api.wolfx.jp/all_eew',
    fan_ws: 'wss://ws.fanstudio.tech/all',
    fan2_ws: 'wss://ws.fanstudio.hk/all',
    p2pquake_ws: 'wss://api.p2pquake.net/v2/ws'
}

const _withBase = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\//, '')}`
export const tsunamiUrls = {
    jmaTsunami_http: 'https://api.p2pquake.net/v2/history?codes=552&limit=1',
}
export const seisNetUrls = {
    nied: {
        stationList: 'https://weather-kyoshin.east.edge.storage-yahoo.jp/SiteList/sitelist.json',
        stationData: 'https://weather-kyoshin.east.edge.storage-yahoo.jp/RealTimeData'
    },
    kma: 'wss://ws.fanstudio.tech/kma-station'
}
export const iconUrls = {
    info: _withBase('icon/info.png'),
    caution: _withBase('icon/caution.png'),
    warn: _withBase('icon/warn.png'),
}
export const chimeUrls = {
    general: {
        countdown: _withBase('sound/general/countdown.wav'),
        intense: _withBase('sound/general/intense.wav'),
        ews: _withBase('sound/general/ews.mp3'),
        '0s': _withBase('sound/general/0s.mp3'),
        '1s': _withBase('sound/general/1s.mp3'),
        '2s': _withBase('sound/general/2s.mp3'),
        '3s': _withBase('sound/general/3s.mp3'),
        '4s': _withBase('sound/general/4s.mp3'),
        '5s': _withBase('sound/general/5s.mp3'),
        '6s': _withBase('sound/general/6s.mp3'),
        '7s': _withBase('sound/general/7s.mp3'),
        '8s': _withBase('sound/general/8s.mp3'),
        '9s': _withBase('sound/general/9s.mp3'),
        '10s': _withBase('sound/general/10s.mp3'),
        '20s': _withBase('sound/general/20s.mp3'),
        '30s': _withBase('sound/general/30s.mp3'),
        '40s': _withBase('sound/general/40s.mp3'),
        '50s': _withBase('sound/general/50s.mp3'),
        '60s': _withBase('sound/general/60s.mp3'),
    },
    srev: {
        issue: _withBase('sound/srev/issue.mp3'),
        caution: _withBase('sound/srev/caution.mp3'),
        warn: _withBase('sound/srev/warn.mp3'),
        update: _withBase('sound/srev/update.mp3'),
        final: _withBase('sound/srev/final.mp3'),
        cancel: _withBase('sound/srev/cancel.mp3'),
        prompt: _withBase('sound/srev/prompt.mp3'),
        hypocenter: _withBase('sound/srev/hypocenter.mp3'),
        detail: _withBase('sound/srev/detail.mp3'),
        shindo0: _withBase('sound/srev/shindo0.mp3'),
        shindo1: _withBase('sound/srev/shindo1.mp3'),
        shindo2: _withBase('sound/srev/shindo2.mp3'),
        shindo3: _withBase('sound/srev/shindo3.mp3'),
        shindo4: _withBase('sound/srev/shindo4.mp3'),
        shindo5: _withBase('sound/srev/shindo5.mp3'),
        shindo6: _withBase('sound/srev/shindo6.mp3'),
        shindo7: _withBase('sound/srev/shindo6.mp3'),
        tsunami1issue: _withBase('sound/srev/tsunami1issue.mp3'),
        tsunami1update: _withBase('sound/srev/tsunami1update.mp3'),
        tsunami1switch: _withBase('sound/srev/tsunami1switch.mp3'),
        tsunami1cancel: _withBase('sound/srev/tsunami1cancel.mp3'),
        tsunami2issue: _withBase('sound/srev/tsunami2issue.mp3'),
        tsunami2update: _withBase('sound/srev/tsunami2update.mp3'),
        tsunami2switch: _withBase('sound/srev/tsunami2switch.mp3'),
        tsunami2cancel: _withBase('sound/srev/tsunami2cancel.mp3'),
        tsunami3issue: _withBase('sound/srev/tsunami3issue.mp3'),
        tsunami3update: _withBase('sound/srev/tsunami3update.mp3'),
        tsunami3cancel: _withBase('sound/srev/tsunami3cancel.mp3'),
    },
    custom: {}
}
export const topojsonUrls = {
    global: _withBase('json/medium.global.modified.topo.json'),
    cn: _withBase('json/cn.province.topo.json'),
    cn_eew: _withBase('json/cn.eew.topo.json'),
    cn_fault: _withBase('json/cn.fault.modified.topo.json'),
    jp: _withBase('json/jp.pref.topo.json'),
    jp_eew: _withBase('json/jp.eew.topo.json'),
    jp_tsunami: _withBase('json/jp.tsunami.topo.json')
}
export const utilUrls = {
    geoIp: 'https://api.wolfx.jp/geoip.php',
    ntpTime: 'https://api.fanstudio.tech/tool/ntp.php',
}