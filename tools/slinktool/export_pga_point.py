import argparse
import json
import os
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path


@dataclass(frozen=True)
class SamplePoint:
	t_ms: int
	v: float


def _default_outfile() -> Path:
	# kanameishi/tools/slinktool 配下に同梱して使う想定
	# <repo>/tools/slinktool -> <repo>/public/pga_points.json
	base = Path(__file__).resolve().parent
	repo_root = base.parent.parent
	return repo_root / "public" / "pga_points.json"


def _atomic_write_json(path: Path, payload: object) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	tmp = path.with_suffix(path.suffix + ".tmp")
	tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
	# Windows では読み取り中に os.replace が失敗することがあるため、短時間リトライする
	last_err: Exception | None = None
	for _ in range(10):
		try:
			os.replace(tmp, path)
			return
		except Exception as e:
			last_err = e
			time.sleep(0.05)
	# 最終手段: 直書き（atomic ではないがクラッシュ回避を優先）
	try:
		path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
		try:
			if tmp.exists():
				tmp.unlink()
		except Exception:
			pass
		return
	except Exception:
		# ここまで来たら呼び出し側に例外を投げる
		if last_err:
			raise last_err
		raise RuntimeError("failed to write json")


def _trim_points_window(points: list[list[float]], window_ms: int) -> list[list[float]]:
	if not points or not window_ms:
		return points
	# points: [[t_ms, v], ...] sorted by t_ms
	latest_t = points[-1][0]
	cutoff = latest_t - window_ms
	i = 0
	n = len(points)
	while i < n and points[i][0] < cutoff:
		i += 1
	return points[i:]


def _compute_shake(points: list[list[float]], window_ms: int) -> dict:
	def _rms(vals: list[float]) -> float:
		if not vals:
			return 0.0
		s = 0.0
		for v in vals:
			s += v * v
		return (s / len(vals)) ** 0.5

	def _peak(vals: list[float]) -> float:
		m = 0.0
		for v in vals:
			av = abs(v)
			if av > m:
				m = av
		return m

	if not points or len(points) < 10:
		return {
			"detected": False,
			"current_rms": 0.0,
			"baseline_rms": 0.0,
			"current_peak": 0.0,
			"baseline_peak": 0.0,
			"current_window_sec": 10,
			"baseline_exclude_last_sec": 20,
			"window_sec": int(window_ms / 1000) if window_ms else 0,
		}

	points = sorted(points, key=lambda x: x[0])
	last_t = points[-1][0]
	cur_from = last_t - 10_000
	base_from = last_t - (window_ms or 180_000)
	base_to = last_t - 20_000

	cur_vals: list[float] = []
	base_vals: list[float] = []
	for t_ms, v in points:
		if t_ms >= cur_from:
			cur_vals.append(float(v))
		elif t_ms >= base_from and t_ms < base_to:
			base_vals.append(float(v))

	if not base_vals:
		for t_ms, v in points:
			if t_ms < cur_from:
				base_vals.append(float(v))

	cur_rms = _rms(cur_vals)
	base_rms = _rms(base_vals)
	cur_peak = _peak(cur_vals)
	base_peak = _peak(base_vals)

	eps = 1.0
	base_rms_eff = max(base_rms, eps)
	base_peak_eff = max(base_peak, eps)
	detected = (cur_rms > base_rms_eff * 6.0 and cur_peak > base_peak_eff * 6.0) or (cur_peak > base_peak_eff * 10.0)

	return {
		"detected": bool(detected),
		"current_rms": float(cur_rms),
		"baseline_rms": float(base_rms),
		"current_peak": float(cur_peak),
		"baseline_peak": float(base_peak),
		"current_window_sec": 10,
		"baseline_exclude_last_sec": 20,
		"window_sec": int(window_ms / 1000) if window_ms else 0,
	}


def _estimate_shindo(points: list[list[float]], window_ms: int) -> dict:
	"""単成分・未較正の簡易推定震度。

	注意: BHZのcounts等からの推定であり、公式の計測震度ではない。
	"""
	shake = _compute_shake(points, window_ms)
	cur_peak = float(shake.get("current_peak") or 0.0)
	base_peak = float(shake.get("baseline_peak") or 0.0)
	cur_rms = float(shake.get("current_rms") or 0.0)
	base_rms = float(shake.get("baseline_rms") or 0.0)

	eps = 1.0
	base_peak_eff = max(abs(base_peak), eps)
	base_rms_eff = max(abs(base_rms), eps)
	ratio_peak = abs(cur_peak) / base_peak_eff
	ratio_rms = abs(cur_rms) / base_rms_eff

	if abs(cur_peak) < eps * 2 and abs(cur_rms) < eps * 2:
		label = "0"
	else:
		r = max(ratio_peak, ratio_rms)
		if r < 2.0:
			label = "0"
		elif r < 3.0:
			label = "1"
		elif r < 4.0:
			label = "2"
		elif r < 6.0:
			label = "3"
		elif r < 9.0:
			label = "4"
		elif r < 13.0:
			label = "5-"
		elif r < 18.0:
			label = "5+"
		elif r < 25.0:
			label = "6-"
		elif r < 35.0:
			label = "6+"
		else:
			label = "7"

	value = None
	if label in {"0", "1", "2", "3", "4", "7"}:
		value = int(label)
	elif label.startswith("5"):
		value = 5
	elif label.startswith("6"):
		value = 6

	ts_ms = int(points[-1][0]) if points else None
	return {
		"label": label,
		"value": value,
		"ts_ms": ts_ms,
		"method": "relative_amplitude_ratio",
		"ratio_peak": float(ratio_peak),
		"ratio_rms": float(ratio_rms),
		"current_peak": float(cur_peak),
		"baseline_peak": float(base_peak),
		"current_rms": float(cur_rms),
		"baseline_rms": float(base_rms),
		"note": "heuristic; single-component and uncalibrated",
	}


def _iter_mseed_records_from_file(path: Path, record_size: int, start_offset: int = 0):
	with path.open("rb") as f:
		if start_offset:
			f.seek(start_offset)
		while True:
			chunk = f.read(record_size)
			if len(chunk) != record_size:
				break
			yield chunk


def _record_to_pga_points(record_bytes: bytes, scale: float) -> list[SamplePoint]:
	# 1レコード(512B)→1Traceの想定。複数Traceが出た場合も全部見る。
	from obspy import read  # type: ignore

	st = read(BytesIO(record_bytes), format="MSEED")
	points: list[SamplePoint] = []
	for tr in st:
		if tr.stats.npts <= 0:
			continue
		data = tr.data
		try:
			# numpy array 想定
			pga = float((abs(data)).max()) * scale
		except Exception:
			continue
		t_ms = int(tr.stats.endtime.timestamp * 1000)
		points.append(SamplePoint(t_ms=t_ms, v=pga))
	return points


def _record_to_waveform_points(record_bytes: bytes, scale: float, every: int) -> list[SamplePoint]:
	from obspy import read  # type: ignore

	st = read(BytesIO(record_bytes), format="MSEED")
	points: list[SamplePoint] = []
	if every < 1:
		every = 1

	for tr in st:
		npts = int(getattr(tr.stats, "npts", 0) or 0)
		if npts <= 0:
			continue
		sr = float(getattr(tr.stats, "sampling_rate", 0.0) or 0.0)
		if sr <= 0:
			continue
		start_ms = int(tr.stats.starttime.timestamp * 1000)
		step_ms = 1000.0 / sr
		data = tr.data
		try:
			for i in range(0, npts, every):
				v = float(data[i]) * scale
				t_ms = int(round(start_ms + i * step_ms))
				points.append(SamplePoint(t_ms=t_ms, v=v))
		except Exception:
			continue

	return points


def _load_existing_points(out_path: Path) -> list[list[float]]:
	if not out_path.exists():
		return []
	try:
		text = out_path.read_text(encoding="utf-8")
	except Exception:
		return []
	if not text.strip():
		return []
	try:
		parsed = json.loads(text)
	except Exception:
		return []
	pts = parsed if isinstance(parsed, list) else parsed.get("points")
	if not isinstance(pts, list):
		return []
	out: list[list[float]] = []
	for p in pts:
		if isinstance(p, list) and len(p) >= 2:
			out.append([float(p[0]), float(p[1])])
	return out


def export_once(
	mseed_path: Path,
	out_path: Path,
	lat: float,
	lon: float,
	unit: str,
	scale: float,
	mode: str,
	every: int,
	max_points: int,
	window_sec: int,
) -> None:
	points: list[list[float]] = []
	for rec in _iter_mseed_records_from_file(mseed_path, record_size=512):
		if mode == "waveform":
			for pt in _record_to_waveform_points(rec, scale=scale, every=every):
				points.append([pt.t_ms, pt.v])
		else:
			for pt in _record_to_pga_points(rec, scale=scale):
				points.append([pt.t_ms, pt.v])
	points.sort(key=lambda x: x[0])
	window_ms = int(window_sec * 1000) if window_sec and window_sec > 0 else 0
	if window_ms:
		points = _trim_points_window(points, window_ms)
	if max_points and len(points) > max_points:
		points = points[-max_points:]

	payload = {
		"lat": lat,
		"lon": lon,
		"mode": mode,
		"unit": unit,
		"shake": _compute_shake(points, window_ms),
		"shindo_est": _estimate_shindo(points, window_ms),
		"points": points,
	}
	_atomic_write_json(out_path, payload)


def follow_file(
	mseed_path: Path,
	out_path: Path,
	lat: float,
	lon: float,
	unit: str,
	scale: float,
	mode: str,
	every: int,
	interval_sec: float,
	max_points: int,
	window_sec: int,
) -> None:
	offset = 0
	points = _load_existing_points(out_path)
	points.sort(key=lambda x: x[0])
	window_ms = int(window_sec * 1000) if window_sec and window_sec > 0 else 0
	if window_ms:
		points = _trim_points_window(points, window_ms)

	# 既存ファイルがある場合は末尾から追記（中身を再解析しない）
	if mseed_path.exists():
		offset = (mseed_path.stat().st_size // 512) * 512

	last_write = 0.0
	while True:
		try:
			size = mseed_path.stat().st_size
		except FileNotFoundError:
			time.sleep(interval_sec)
			continue

		# 512B単位で読める範囲まで
		readable = (size // 512) * 512
		if readable > offset:
			with mseed_path.open("rb") as f:
				f.seek(offset)
				while offset < readable:
					rec = f.read(512)
					if len(rec) != 512:
						break
					offset += 512
					if mode == "waveform":
						for pt in _record_to_waveform_points(rec, scale=scale, every=every):
							points.append([pt.t_ms, pt.v])
					else:
						for pt in _record_to_pga_points(rec, scale=scale):
							points.append([pt.t_ms, pt.v])

			points.sort(key=lambda x: x[0])
			if window_ms:
				points = _trim_points_window(points, window_ms)
			if max_points and len(points) > max_points:
				points = points[-max_points:]

		now = time.time()
		if now - last_write >= interval_sec:
			# 新規データが無い周期でも、ウィンドウを維持して古い点を捨てる
			if points:
				points.sort(key=lambda x: x[0])
				if window_ms:
					points = _trim_points_window(points, window_ms)
				if max_points and len(points) > max_points:
					points = points[-max_points:]
			payload = {"lat": lat, "lon": lon, "mode": mode, "unit": unit, "shake": _compute_shake(points, window_ms), "points": points}
			_atomic_write_json(out_path, payload)
			last_write = now

		time.sleep(0.2)


def main() -> None:
	parser = argparse.ArgumentParser(description="Export time series from miniSEED to kanameishi public/pga_points.json")
	parser.add_argument("mseed", type=Path, help="Input miniSEED file that grows over time")
	parser.add_argument("--out", type=Path, default=_default_outfile(), help="Output JSON path (default: <repo>/public/pga_points.json)")
	parser.add_argument("--lat", type=float, required=True)
	parser.add_argument("--lon", type=float, required=True)
	parser.add_argument("--assume-unit", type=str, default="m/s^2")
	parser.add_argument("--mode", choices=["pga", "waveform"], default="pga", help="Export mode")
	parser.add_argument("--every", type=int, default=1, help="For waveform mode: keep every Nth sample (1=all)")
	parser.add_argument("--scale", type=float, default=1.0, help="Multiply output values by this scale factor")
	parser.add_argument("--max-points", type=int, default=600, help="Keep last N points (0 = unlimited)")
	parser.add_argument("--window-sec", type=int, default=180, help="Keep only last N seconds of data in JSON (0=disable)")
	parser.add_argument("--follow", action="store_true", help="Follow file growth and update JSON periodically")
	parser.add_argument("--interval", type=float, default=1.0, help="JSON update interval (seconds) in --follow mode")
	args = parser.parse_args()

	if args.follow:
		follow_file(
			mseed_path=args.mseed,
			out_path=args.out,
			lat=args.lat,
			lon=args.lon,
			unit=args.assume_unit,
			scale=args.scale,
			mode=args.mode,
			every=args.every,
			interval_sec=args.interval,
			max_points=args.max_points,
			window_sec=args.window_sec,
		)
	else:
		export_once(
			mseed_path=args.mseed,
			out_path=args.out,
			lat=args.lat,
			lon=args.lon,
			unit=args.assume_unit,
			scale=args.scale,
			mode=args.mode,
			every=args.every,
			max_points=args.max_points,
			window_sec=args.window_sec,
		)


if __name__ == "__main__":
	main()
