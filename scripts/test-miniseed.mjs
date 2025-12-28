import fs from 'node:fs';
import { parseSingleDataRecord } from 'seisplotjs-miniseed';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/test-miniseed.mjs <path-to-mseed>');
  process.exit(2);
}

const buf = fs.readFileSync(path);
const rec = buf.subarray(0, 512);
const ab = rec.buffer.slice(rec.byteOffset, rec.byteOffset + rec.byteLength);
const dr = parseSingleDataRecord(new DataView(ab));
console.log({
  network: dr.header.netCode,
  station: dr.header.staCode,
  location: dr.header.locCode,
  channel: dr.header.chanCode,
  sampleRate: dr.header.sampleRate,
  recordLength: rec.byteLength,
});

const samples = dr.decompress();
let peak = 0;
for (const s of samples) {
  const a = Math.abs(s);
  if (a > peak) peak = a;
}
console.log({ samples: samples.length, peakCounts: peak });
