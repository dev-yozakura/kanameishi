let Spoints;
fetch(`${import.meta.env.BASE_URL}resources/Snet_Points.json`)
    .then(res => res.json())
    .then(json => {
        Spoints = json.filter(elm => elm.Point && !elm.IsSuspended);
        self.postMessage({ type: 'initialized' });
    });

const ColorTable = { "0": { "0": { "205": -3 }, "7": { "209": -2.9 }, "14": { "214": -2.8 }, "21": { "218": -2.7 }, "28": { "223": -2.6 }, "36": { "227": -2.5 }, "43": { "231": -2.4 }, "50": { "236": -2.3 }, "57": { "240": -2.2 }, "64": { "245": -2.1 }, "72": { "250": -2 }, "85": { "238": -1.9 }, "99": { "227": -1.8 }, "112": { "216": -1.7 }, "126": { "205": -1.6 }, "140": { "194": -1.5 }, "153": { "183": -1.4 }, "167": { "172": -1.3 }, "180": { "161": -1.2 }, "194": { "150": -1.1 }, "208": { "139": -1 } }, "6": { "212": { "130": -0.9 } }, "12": { "216": { "121": -0.8 } }, "18": { "220": { "113": -0.7 } }, "25": { "224": { "104": -0.6 } }, "31": { "228": { "96": -0.5 } }, "37": { "233": { "88": -0.4 } }, "44": { "237": { "79": -0.3 } }, "50": { "241": { "71": -0.2 } }, "56": { "245": { "62": -0.1 } }, "63": { "250": { "54": 0 } }, "75": { "250": { "49": 0.1 } }, "88": { "250": { "45": 0.2 } }, "100": { "251": { "41": 0.3 } }, "113": { "251": { "37": 0.4 } }, "125": { "252": { "33": 0.5 } }, "138": { "252": { "28": 0.6 } }, "151": { "253": { "24": 0.7 } }, "163": { "253": { "20": 0.8 } }, "170": { "0": { "0": 7 } }, "176": { "254": { "16": 0.9 } }, "177": { "0": { "0": 6.9 } }, "185": { "0": { "0": 6.8 } }, "189": { "255": { "12": 1 } }, "192": { "0": { "0": 6.7 } }, "195": { "254": { "10": 1.1 } }, "200": { "0": { "0": 6.6 } }, "202": { "254": { "9": 1.2 } }, "208": { "0": { "0": 6.5 }, "254": { "8": 1.3 } }, "215": { "0": { "0": 6.4 }, "254": { "7": 1.4 } }, "222": { "255": { "5": 1.5 } }, "223": { "0": { "0": 6.3 } }, "228": { "254": { "4": 1.6 } }, "230": { "0": { "0": 6.2 } }, "235": { "255": { "3": 1.7 } }, "238": { "0": { "0": 6.1 } }, "241": { "254": { "2": 1.8 } }, "245": { "0": { "0": 6 } }, "246": { "6": { "0": 5.9 } }, "247": { "13": { "0": 5.8 } }, "248": { "20": { "0": 5.7 }, "255": { "1": 1.9 } }, "249": { "27": { "0": 5.6 } }, "250": { "33": { "0": 5.5 } }, "251": { "40": { "0": 5.4 } }, "252": { "47": { "0": 5.3 } }, "253": { "54": { "0": 5.2 } }, "254": { "61": { "0": 5.1 } }, "255": { "0": { "0": 5 }, "68": { "0": 4 }, "144": { "0": 3 }, "221": { "0": 2 } } };

function RGBtoP(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    let v = max;
    if (max != min) {
        if (max == r) h = (60 * (g - b)) / (max - min);
        if (max == g) h = (60 * (b - r)) / (max - min) + 120;
        if (max == b) h = (60 * (r - g)) / (max - min) + 240;
        s = (max - min) / max;
    }
    if (h < 0) h = h + 360;
    h = h / 360;
    s = s;
    v = v / 255;
    let p = 0;
    if (v > 0.1 && s > 0.75) {
        if (h > 0.1476) {
            p = 280.31 * Math.pow(h, 6) - 916.05 * Math.pow(h, 5) + 1142.6 * Math.pow(h, 4) - 709.95 * Math.pow(h, 3) + 234.65 * Math.pow(h, 2) - 40.27 * h + 3.2217;
        } else if (h > 0.001) {
            p = 151.4 * Math.pow(h, 4) - 49.32 * Math.pow(h, 3) + 6.753 * Math.pow(h, 2) - 2.481 * h + 0.9033;
        } else p = -0.005171 * Math.pow(v, 2) - 0.3282 * v + 1.2236;
    }
    if (p < 0) p = 0;
    return p;
}

self.onmessage = async (event) => {
    const { imageBitmap, y, uid } = event.data;
    if (!Spoints) return;

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(imageBitmap, 0, 0);
    const imagedata = context.getImageData(0, 0, canvas.width, canvas.height).data;

    const Spoints_f = Spoints.filter(el => el.TileID == (y == 12 ? 1 : 2));
    
    const decodedData = {};

    Spoints_f.forEach(elm => {
        const index = elm.Point.Y * 256 + elm.Point.X;
        const rgb = [
            imagedata[4 * index],
            imagedata[4 * index + 1],
            imagedata[4 * index + 2],
            imagedata[4 * index + 3],
        ];

        if (rgb[3]) {
            let shindo = ColorTable[rgb[0]]?.[rgb[1]]?.[rgb[2]];
            if (shindo === undefined) {
                const tmpNum = 10 ** (5 * RGBtoP(rgb[0], rgb[1], rgb[2]) - 2);
                shindo = 0.868589 * Math.log(tmpNum) + 1;
            }
            decodedData[elm.Code] = { shindo, pga: 10 ** (5 * ((shindo + 3) / 10) - 2) };
        } else {
            decodedData[elm.Code] = { shindo: null, pga: 0 };
        }
    });

    self.postMessage({ type: 'decoded', data: decodedData, y, uid });
};
