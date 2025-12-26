import argparse
import json
import os
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path


def _norm_unit_text(s: str) -> str:
    return (s or "").strip().lower().replace("μ", "u").replace("µ", "u")


@dataclass
class FileState:
    offset: int
    points: list[list[float]]
    last_write: float


def _trim_points_window(points: list[list[float]], window_ms: int) -> list[list[float]]:
    if not points or not window_ms:
        return points
    # points: [[t_ms, v], ...] sorted by t_ms
    latest_t = points[-1][0]
    cutoff = latest_t - window_ms
    # keep >= cutoff
    i = 0
    n = len(points)
    while i < n and points[i][0] < cutoff:
        i += 1
    return points[i:]


def _compute_shake(points: list[list[float]], total_window_ms: int) -> dict:
    """Compute a simple motion detection metric from waveform points.

    Heuristic:
      - current window: last 10 seconds
      - baseline window: older part of the kept window, excluding last 20 seconds

    Returns a dict safe to embed in JSON.
    """

    def _rms(vals: list[float]) -> float:
        if not vals:
            return 0.0
        s = 0.0
        for v in vals:
            s += v * v
        return (s / len(vals)) ** 0.5

    def _peak(vals: list[float]) -> float:
        if not vals:
            return 0.0
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
            "window_sec": int(total_window_ms / 1000) if total_window_ms else 0,
        }

    # Ensure sorted
    points = sorted(points, key=lambda x: x[0])
    last_t = points[-1][0]

    cur_from = last_t - 10_000
    base_from = last_t - (total_window_ms or 180_000)
    base_to = last_t - 20_000

    cur_vals: list[float] = []
    base_vals: list[float] = []
    for t_ms, v in points:
        if t_ms >= cur_from:
            cur_vals.append(float(v))
        elif t_ms >= base_from and t_ms < base_to:
            base_vals.append(float(v))

    # Fallback baseline: everything excluding last 10 seconds
    if not base_vals:
        for t_ms, v in points:
            if t_ms < cur_from:
                base_vals.append(float(v))

    cur_rms = _rms(cur_vals)
    base_rms = _rms(base_vals)
    cur_peak = _peak(cur_vals)
    base_peak = _peak(base_vals)

    # Heuristic thresholds (relative)
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
        "window_sec": int(total_window_ms / 1000) if total_window_ms else 0,
    }


def _estimate_shindo(points: list[list[float]], total_window_ms: int) -> dict:
    """Estimate a rough JMA shindo-like level from a single-component waveform.

    IMPORTANT:
      - This is NOT an official instrumental intensity.
      - With raw counts and only one component (often BHZ), we can only provide a
        heuristic estimate based on relative amplitude (current vs baseline).

    The output is designed for UI display.
    """

    shake = _compute_shake(points, total_window_ms)
    cur_peak = float(shake.get("current_peak") or 0.0)
    base_peak = float(shake.get("baseline_peak") or 0.0)
    cur_rms = float(shake.get("current_rms") or 0.0)
    base_rms = float(shake.get("baseline_rms") or 0.0)

    # Avoid division by tiny baseline.
    eps = 1.0
    base_peak_eff = max(abs(base_peak), eps)
    base_rms_eff = max(abs(base_rms), eps)
    ratio_peak = abs(cur_peak) / base_peak_eff
    ratio_rms = abs(cur_rms) / base_rms_eff

    # If there's effectively no motion, report 0.
    if abs(cur_peak) < eps * 2 and abs(cur_rms) < eps * 2:
        label = "0"
    else:
        r = max(ratio_peak, ratio_rms)
        # Heuristic mapping to familiar shindo labels.
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

    # Best-effort numeric level for sorting (5-/5+ -> 5, 6-/6+ -> 6).
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


def _shindo_label_from_inst_intensity(I: float) -> str:
    if I < 0.5:
        return "0"
    if I < 1.5:
        return "1"
    if I < 2.5:
        return "2"
    if I < 3.5:
        return "3"
    if I < 4.5:
        return "4"
    if I < 5.0:
        return "5-"
    if I < 5.5:
        return "5+"
    if I < 6.0:
        return "6-"
    if I < 6.5:
        return "6+"
    return "7"


def _align_three_series_by_time(
    a: list[list[float]],
    b: list[list[float]],
    c: list[list[float]],
    tolerance_ms: int,
) -> tuple[list[float], list[float], list[float], list[float]]:
    """Align three [t_ms, v] series by timestamp using a tolerance.

    Returns (t_sec, va, vb, vc) aligned.
    """
    if not a or not b or not c:
        return [], [], [], []

    a2 = sorted(a, key=lambda x: x[0])
    b2 = sorted(b, key=lambda x: x[0])
    c2 = sorted(c, key=lambda x: x[0])

    i = j = k = 0
    t_sec: list[float] = []
    va: list[float] = []
    vb: list[float] = []
    vc: list[float] = []

    while i < len(a2) and j < len(b2) and k < len(c2):
        ta = float(a2[i][0])
        tb = float(b2[j][0])
        tc = float(c2[k][0])
        tmin = min(ta, tb, tc)
        tmax = max(ta, tb, tc)
        if (tmax - tmin) <= tolerance_ms:
            t = (ta + tb + tc) / 3.0
            try:
                va.append(float(a2[i][1]))
                vb.append(float(b2[j][1]))
                vc.append(float(c2[k][1]))
                t_sec.append(t / 1000.0)
            except Exception:
                pass
            i += 1
            j += 1
            k += 1
            continue

        if ta == tmin:
            i += 1
        elif tb == tmin:
            j += 1
        else:
            k += 1

    return t_sec, va, vb, vc


def _compute_inst_shindo_3c(
    points_n: list[list[float]] | None,
    points_e: list[list[float]] | None,
    points_z: list[list[float]] | None,
    total_window_ms: int,
    unit: str,
    freqmin: float = 0.5,
    freqmax: float = 5.0,
) -> dict:
    """3成分からの簡易「計測震度」計算。

    前提:
      - points_* は [t_ms, v] (v は速度) の時系列
      - unit が "cm/s" または "m/s" の場合のみ、gal (cm/s^2) とみなせる

    注意:
      - センサー応答/較正が不明な counts では公式の計測震度にならないため available=false。
      - 0.5–5 Hz 帯域通過(ゼロ位相) + 合成加速度最大 を使う簡易実装。
    """
    points_n = points_n or []
    points_e = points_e or []
    points_z = points_z or []

    if len(points_n) < 50 or len(points_e) < 50 or len(points_z) < 50:
        return {"available": False, "reason": "insufficient_points"}

    u = _norm_unit_text(unit)
    if u not in {"cm/s", "m/s", "um/s"}:
        return {"available": False, "reason": f"unsupported_unit:{unit}"}

    # Use only the last window for performance.
    def _trim(points: list[list[float]]) -> list[list[float]]:
        if not points or not total_window_ms:
            return points
        pts = sorted(points, key=lambda x: x[0])
        cutoff = pts[-1][0] - total_window_ms
        idx = 0
        while idx < len(pts) and pts[idx][0] < cutoff:
            idx += 1
        return pts[idx:]

    pn = _trim(points_n)
    pe = _trim(points_e)
    pz = _trim(points_z)

    # Estimate sampling interval (ms) from Z component.
    zt = [float(p[0]) for p in pz[: min(2000, len(pz))] if isinstance(p, list) and len(p) >= 2]
    dts = []
    for idx in range(1, len(zt)):
        dt = zt[idx] - zt[idx - 1]
        if dt > 0:
            dts.append(dt)
    if not dts:
        return {"available": False, "reason": "cannot_estimate_dt"}
    dts.sort()
    dt_ms = float(dts[len(dts) // 2])
    if dt_ms <= 0:
        return {"available": False, "reason": "invalid_dt"}

    tol_ms = int(max(1.0, dt_ms * 0.6))
    t_sec, vn, ve, vz = _align_three_series_by_time(pn, pe, pz, tolerance_ms=tol_ms)
    if len(t_sec) < 100:
        return {"available": False, "reason": "insufficient_aligned_points"}

    # Convert velocity to cm/s
    if u == "m/s":
        scale_to_cm_s = 100.0
    elif u == "cm/s":
        scale_to_cm_s = 1.0
    else:  # um/s
        scale_to_cm_s = 1e-4

    if scale_to_cm_s != 1.0:
        vn = [v * scale_to_cm_s for v in vn]
        ve = [v * scale_to_cm_s for v in ve]
        vz = [v * scale_to_cm_s for v in vz]

    # Differentiate to acceleration (cm/s^2 == gal)
    import numpy as np
    from scipy.signal import butter, filtfilt

    t = np.asarray(t_sec, dtype=float)
    vna = np.asarray(vn, dtype=float)
    vea = np.asarray(ve, dtype=float)
    vza = np.asarray(vz, dtype=float)

    # Remove DC offset
    vna = vna - np.nanmean(vna)
    vea = vea - np.nanmean(vea)
    vza = vza - np.nanmean(vza)

    dt = float(np.nanmedian(np.diff(t)))
    if not np.isfinite(dt) or dt <= 0:
        return {"available": False, "reason": "invalid_dt_seconds"}

    an = np.gradient(vna, dt)
    ae = np.gradient(vea, dt)
    az = np.gradient(vza, dt)
    a = np.sqrt(an * an + ae * ae + az * az)

    # Bandpass 0.5–5 Hz (zero-phase)
    fs = 1.0 / dt
    nyq = fs / 2.0
    if freqmax >= nyq:
        # Cannot filter meaningfully; avoid crashing
        return {"available": False, "reason": "freqmax_ge_nyquist"}

    b, aa = butter(N=4, Wn=[freqmin / nyq, freqmax / nyq], btype="band")
    try:
        af = filtfilt(b, aa, a)
    except Exception:
        return {"available": False, "reason": "filter_failed"}

    amax = float(np.nanmax(np.abs(af)))
    if not np.isfinite(amax) or amax <= 0:
        return {"available": False, "reason": "nonpositive_amax"}

    I = float(2.0 * np.log10(amax) + 0.94)
    label = _shindo_label_from_inst_intensity(I)
    return {
        "available": True,
        "I": I,
        "amax_gal": amax,
        "label": label,
        "method": "3c_bandpass_vector_max",
        "freqmin_hz": float(freqmin),
        "freqmax_hz": float(freqmax),
        "unit_velocity": unit,
        "note": "instrument response not removed; only valid if velocity is calibrated",
    }


def _atomic_write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    # On Windows, os.replace can fail with WinError 5 if the destination file
    # is momentarily opened by another process (e.g., dev server reading).
    # Retry a few times, then fall back to direct write.
    for _ in range(10):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05)
        except OSError:
            time.sleep(0.05)

    try:
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    finally:
        try:
            tmp.unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass


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
            try:
                out.append([float(p[0]), float(p[1])])
            except Exception:
                continue
    return out


def _record_to_waveform_points(record_bytes: bytes, scale: float, every: int) -> list[list[float]]:
    from obspy import read  # type: ignore

    if every < 1:
        every = 1

    st = read(BytesIO(record_bytes), format="MSEED")
    out: list[list[float]] = []
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
                out.append([t_ms, v])
        except Exception:
            continue

    return out


def _derive_accel_points_from_velocity_points(
    points: list[list[float]] | None,
    unit_velocity: str,
    freqmin: float = 0.5,
    freqmax: float = 5.0,
) -> tuple[list[list[float]], str, dict]:
    """Derive acceleration points from velocity points.

    Steps (best-effort):
      1) take last-window points already trimmed by caller
      2) detrend (remove mean)
      3) bandpass filter on velocity (zero-phase)
      4) differentiate to acceleration

    Returns: (points_acc, unit_acc, meta)
    """
    pts = points or []
    if len(pts) < 50:
        return [], "", {"available": False, "reason": "insufficient_points"}

    import numpy as np
    from scipy.signal import butter, filtfilt

    pts2 = sorted([p for p in pts if isinstance(p, list) and len(p) >= 2], key=lambda x: x[0])
    t_ms = np.asarray([float(p[0]) for p in pts2], dtype=float)
    v = np.asarray([float(p[1]) for p in pts2], dtype=float)

    # Drop NaNs/infs
    mask = np.isfinite(t_ms) & np.isfinite(v)
    t_ms = t_ms[mask]
    v = v[mask]
    if t_ms.size < 50:
        return [], "", {"available": False, "reason": "insufficient_finite_points"}

    # Estimate dt (seconds) from median spacing
    dt_ms_arr = np.diff(t_ms)
    dt_ms_arr = dt_ms_arr[np.isfinite(dt_ms_arr) & (dt_ms_arr > 0)]
    if dt_ms_arr.size < 10:
        return [], "", {"available": False, "reason": "cannot_estimate_dt"}
    dt_ms = float(np.median(dt_ms_arr))
    dt = dt_ms / 1000.0
    if not np.isfinite(dt) or dt <= 0:
        return [], "", {"available": False, "reason": "invalid_dt"}

    u = _norm_unit_text(unit_velocity)
    # Convert velocity to cm/s for physical units so derived acceleration is in gal.
    if u == "m/s":
        v = v * 100.0
        unit_acc = "gal"
    elif u == "cm/s":
        unit_acc = "gal"
    elif u == "um/s":
        v = v * 1e-4
        unit_acc = "gal"
    else:
        unit_acc = ""

    # Detrend
    v = v - float(np.nanmean(v))

    # Bandpass on velocity (zero-phase)
    fs = 1.0 / dt
    nyq = fs / 2.0
    if freqmax >= nyq:
        return [], "", {"available": False, "reason": "freqmax_ge_nyquist", "nyquist_hz": float(nyq)}
    b, a = butter(N=4, Wn=[freqmin / nyq, freqmax / nyq], btype="band")
    try:
        vf = filtfilt(b, a, v)
    except Exception:
        return [], "", {"available": False, "reason": "filter_failed"}

    # Differentiate
    acc = np.gradient(vf, dt)
    if not np.all(np.isfinite(acc)):
        acc = np.nan_to_num(acc)

    if unit_acc == "gal":
        # already in gal
        pass
    elif u in {"count", "counts", "cts"}:
        # Raw ADC counts; acceleration is still in arbitrary units.
        unit_acc = "counts/s"
    elif not u:
        unit_acc = "a.u./s"
    else:
        unit_acc = f"{unit_velocity}/s"

    out = [[int(t), float(a)] for t, a in zip(t_ms.tolist(), acc.tolist())]
    return out, unit_acc, {
        "available": True,
        "method": "bandpass_velocity_then_gradient",
        "freqmin_hz": float(freqmin),
        "freqmax_hz": float(freqmax),
        "dt_ms": float(dt_ms),
        "unit_velocity": unit_velocity,
        "unit_acc": unit_acc,
    }


class _StationXmlCache:
    def __init__(self, root: Path, ttl_days: int = 30, max_fetch_per_minute: int = 6) -> None:
        self.root = root
        self.ttl_sec = int(ttl_days * 86400)
        self.max_fetch_per_minute = int(max_fetch_per_minute)
        self._fetch_times: list[float] = []

    def _is_rate_limited(self) -> bool:
        now = time.time()
        self._fetch_times = [t for t in self._fetch_times if now - t < 60.0]
        return len(self._fetch_times) >= self.max_fetch_per_minute

    def _note_fetch(self) -> None:
        self._fetch_times.append(time.time())

    def _cache_path(self, net: str, sta: str) -> Path:
        safe = f"{net}_{sta}".replace("..", ".")
        return self.root / f"{safe}.xml"

    def get_inventory(self, net: str, sta: str):
        """Return an ObsPy Inventory for a station (cached on disk).

        Fetch source: IRIS FDSN station service.
        """
        from obspy import read_inventory  # type: ignore
        from obspy.clients.fdsn import Client  # type: ignore

        self.root.mkdir(parents=True, exist_ok=True)
        path = self._cache_path(net, sta)

        def _fresh(p: Path) -> bool:
            try:
                return (time.time() - p.stat().st_mtime) <= self.ttl_sec
            except FileNotFoundError:
                return False

        if path.exists() and _fresh(path):
            try:
                return read_inventory(str(path))
            except Exception:
                # corrupted cache -> refetch
                try:
                    path.unlink(missing_ok=True)  # type: ignore[arg-type]
                except Exception:
                    pass

        if self._is_rate_limited():
            raise RuntimeError("stationxml_rate_limited")

        self._note_fetch()
        client = Client("IRIS")
        inv = client.get_stations(
            network=net,
            station=sta,
            location="*",
            channel="BH?",
            level="response",
        )

        try:
            path.write_bytes(inv.write(format="STATIONXML"))  # type: ignore[attr-defined]
        except Exception:
            # Older ObsPy: Inventory.write writes to filename; fall back.
            try:
                inv.write(str(path), format="STATIONXML")
            except Exception:
                pass
        return inv


def _points_to_trace(points: list[list[float]], net: str, sta: str, chan: str):
    """Best-effort conversion of [[t_ms,v],...] points to an ObsPy Trace."""
    if not points or len(points) < 50:
        return None, {"available": False, "reason": "insufficient_points"}

    from obspy import Trace, UTCDateTime  # type: ignore
    import numpy as np

    pts = sorted([p for p in points if isinstance(p, list) and len(p) >= 2], key=lambda x: x[0])
    t_ms = np.asarray([float(p[0]) for p in pts], dtype=float)
    x = np.asarray([float(p[1]) for p in pts], dtype=float)
    mask = np.isfinite(t_ms) & np.isfinite(x)
    t_ms = t_ms[mask]
    x = x[mask]
    if t_ms.size < 50:
        return None, {"available": False, "reason": "insufficient_finite_points"}

    dt_ms_arr = np.diff(t_ms)
    dt_ms_arr = dt_ms_arr[np.isfinite(dt_ms_arr) & (dt_ms_arr > 0)]
    if dt_ms_arr.size < 10:
        return None, {"available": False, "reason": "cannot_estimate_dt"}
    dt_ms = float(np.median(dt_ms_arr))
    dt = dt_ms / 1000.0
    if not np.isfinite(dt) or dt <= 0:
        return None, {"available": False, "reason": "invalid_dt"}

    t0 = float(t_ms[0])
    idx = np.rint((t_ms - t0) / dt_ms).astype(int)
    n = int(idx.max() + 1)
    if n < 50 or n > 500_000:
        return None, {"available": False, "reason": "invalid_length"}

    data = np.full((n,), np.nan, dtype=float)
    ok = (idx >= 0) & (idx < n)
    data[idx[ok]] = x[ok]

    # Fill gaps (linear interpolation). If too many gaps, skip calibration.
    nan_ratio = float(np.isnan(data).sum()) / float(n)
    if nan_ratio > 0.1:
        return None, {"available": False, "reason": "too_many_gaps", "nan_ratio": nan_ratio}

    if np.isnan(data).any():
        good = np.isfinite(data)
        data = np.interp(np.arange(n), np.flatnonzero(good), data[good]).astype(float)

    tr = Trace(data=data.astype(float))
    tr.stats.network = net
    tr.stats.station = sta
    tr.stats.channel = chan
    tr.stats.starttime = UTCDateTime(t0 / 1000.0)
    tr.stats.sampling_rate = 1.0 / dt
    return tr, {"available": True, "dt_ms": dt_ms, "nan_ratio": nan_ratio}


def _calibrate_counts_points_to_velocity(
    points: list[list[float]] | None,
    *,
    net: str,
    sta: str,
    chan: str,
    cache: _StationXmlCache,
    output_unit: str = "um/s",
) -> tuple[list[list[float]], str, dict]:
    """Calibrate raw counts points to velocity using StationXML response.

    Returns: (points_velocity, unit_velocity, meta)
    """
    pts = points or []
    tr, meta0 = _points_to_trace(pts, net=net, sta=sta, chan=chan)
    if not tr:
        return [], "", {"available": False, **meta0}

    try:
        inv = cache.get_inventory(net, sta)
    except Exception as e:
        return [], "", {"available": False, "reason": "stationxml_fetch_failed", "detail": str(e)}

    inv2 = inv.select(network=net, station=sta, channel=chan, location="*")
    if not inv2 or len(inv2.networks) == 0:
        return [], "", {"available": False, "reason": "stationxml_no_match"}

    # Remove response to get velocity in m/s.
    # Use a conservative pre_filt if possible.
    try:
        fs = float(tr.stats.sampling_rate)
        nyq = fs / 2.0
        f4 = min(0.9 * nyq, 45.0)
        f3 = min(0.8 * nyq, 35.0)
        pre_filt = (0.01, 0.05, f3, f4)
    except Exception:
        pre_filt = (0.01, 0.05, 30.0, 40.0)

    try:
        tr2 = tr.copy()
        tr2.remove_response(inventory=inv2, output="VEL", pre_filt=pre_filt, water_level=60)
    except Exception as e:
        return [], "", {"available": False, "reason": "remove_response_failed", "detail": str(e)}

    import numpy as np

    data = np.asarray(tr2.data, dtype=float)
    if data.size < 50 or not np.isfinite(data).any():
        return [], "", {"available": False, "reason": "invalid_calibrated_data"}

    out_unit = _norm_unit_text(output_unit)
    if out_unit in {"um/s", "μm/s", "µm/s"}:
        data = data * 1e6
        unit_vel = "um/s"
    elif out_unit == "cm/s":
        data = data * 100.0
        unit_vel = "cm/s"
    else:
        unit_vel = "m/s"

    t0_ms = int(round(float(tr2.stats.starttime.timestamp) * 1000.0))
    dt_ms = int(round(1000.0 / float(tr2.stats.sampling_rate)))
    out = [[t0_ms + i * dt_ms, float(v)] for i, v in enumerate(data.tolist())]
    return out, unit_vel, {
        "available": True,
        "method": "stationxml_remove_response",
        "pre_filt": list(pre_filt),
        "water_level": 60,
        "unit_velocity": unit_vel,
        "dt_ms": dt_ms,
        "note": "velocity derived from counts using IRIS StationXML response",
    }


def _parse_station_from_filename(path: Path) -> tuple[str, str, str] | None:
    # Expect: NET_STA_CHAN.mseed (or NET_STA_LOC_CHAN.mseed)
    stem = path.stem
    parts = stem.split("_")
    if len(parts) < 3:
        return None
    net = parts[0].strip()
    sta = parts[1].strip()
    chan = parts[-1].strip()
    if not net or not sta or not chan:
        return None
    return net, sta, chan


def _read_new_records(path: Path, offset: int, record_size: int = 512) -> tuple[int, list[bytes]]:
    try:
        size = path.stat().st_size
    except FileNotFoundError:
        return offset, []

    readable = (size // record_size) * record_size
    if readable <= offset:
        return offset, []

    recs: list[bytes] = []
    with path.open("rb") as f:
        f.seek(offset)
        while offset < readable:
            chunk = f.read(record_size)
            if len(chunk) != record_size:
                break
            recs.append(chunk)
            offset += record_size

    return offset, recs


def follow_dir(
    in_dir: Path,
    out_dir: Path,
    interval_sec: float,
    mode: str,
    every: int,
    max_points: int,
    scale: float,
    unit: str,
    window_sec: int,
    calibrate_stationxml: bool = False,
    calibrate_output_unit: str = "um/s",
) -> None:
    states: dict[Path, FileState] = {}
    window_ms = int(window_sec * 1000) if window_sec and window_sec > 0 else 0

    cache = _StationXmlCache(root=(Path(__file__).parent / ".cache_stationxml"))

    while True:
        # discover files
        try:
            files = sorted([p for p in in_dir.glob("*.mseed") if p.is_file()])
        except FileNotFoundError:
            files = []

        now = time.time()

        for mseed_path in files:
            parsed = _parse_station_from_filename(mseed_path)
            if not parsed:
                continue
            net, sta, chan = parsed
            out_path = out_dir / f"{net}_{sta}_{chan}.json"

            if mseed_path not in states:
                points = _load_existing_points(out_path)
                # Start tailing from current end (aligned) to avoid reprocessing huge history
                try:
                    size = mseed_path.stat().st_size
                    offset = (size // 512) * 512
                except FileNotFoundError:
                    offset = 0
                states[mseed_path] = FileState(offset=offset, points=points, last_write=0.0)

            st = states[mseed_path]
            new_offset, recs = _read_new_records(mseed_path, st.offset, record_size=512)
            st.offset = new_offset

            if recs:
                for rec in recs:
                    if mode == "waveform":
                        st.points.extend(_record_to_waveform_points(rec, scale=scale, every=every))
                    else:
                        # pga mode: one point per record
                        from obspy import read  # type: ignore

                        try:
                            stream = read(BytesIO(rec), format="MSEED")
                        except Exception:
                            continue
                        for tr in stream:
                            if getattr(tr.stats, "npts", 0) <= 0:
                                continue
                            try:
                                pga = float((abs(tr.data)).max()) * scale
                            except Exception:
                                continue
                            t_ms = int(tr.stats.endtime.timestamp * 1000)
                            st.points.append([t_ms, pga])

                st.points.sort(key=lambda x: x[0])

                if window_ms:
                    st.points = _trim_points_window(st.points, window_ms)

                if max_points and len(st.points) > max_points:
                    st.points = st.points[-max_points:]

            # write JSON at most once per interval per station
            if now - st.last_write >= interval_sec:
                # Even if no new records arrived, enforce window trimming so old data disappears.
                if st.points:
                    st.points.sort(key=lambda x: x[0])
                    if window_ms:
                        st.points = _trim_points_window(st.points, window_ms)
                    if max_points and len(st.points) > max_points:
                        st.points = st.points[-max_points:]

                unit_raw = unit
                points_raw = st.points

                # Optional: counts -> calibrated velocity using IRIS StationXML response.
                # This is expensive and therefore guarded by a flag.
                points_eff = points_raw
                unit_eff = unit_raw
                calibration = {"available": False, "reason": "disabled_or_not_counts"}
                if calibrate_stationxml and _norm_unit_text(unit_raw) in {"count", "counts", "cts"}:
                    points_cal, unit_cal, cal_meta = _calibrate_counts_points_to_velocity(
                        points_raw,
                        net=net,
                        sta=sta,
                        chan=chan,
                        cache=cache,
                        output_unit=calibrate_output_unit,
                    )
                    calibration = cal_meta
                    if cal_meta.get("available") and points_cal and unit_cal:
                        points_eff = points_cal
                        unit_eff = unit_cal

                inst_shindo_3c = None
                if chan.upper() == "BHZ":
                    # Best-effort: if BHN/BHE/BHZ exist for this station, compute 3C instrumental shindo.
                    # This will be available only when unit is physical (cm/s or m/s).
                    p_n = None
                    p_e = None
                    for other_path, other_state in states.items():
                        other_parsed = _parse_station_from_filename(other_path)
                        if not other_parsed:
                            continue
                        onet, osta, ochan = other_parsed
                        if onet == net and osta == sta:
                            if ochan.upper() == "BHN":
                                p_n = other_state.points
                            elif ochan.upper() == "BHE":
                                p_e = other_state.points
                    # Use calibrated points if available.
                    # Note: For N/E components, if calibration is enabled we calibrate them too.
                    if calibrate_stationxml and _norm_unit_text(unit_raw) in {"count", "counts", "cts"}:
                        if p_n is not None:
                            p_n, _, _ = _calibrate_counts_points_to_velocity(
                                p_n, net=net, sta=sta, chan="BHN", cache=cache, output_unit=calibrate_output_unit
                            )
                        if p_e is not None:
                            p_e, _, _ = _calibrate_counts_points_to_velocity(
                                p_e, net=net, sta=sta, chan="BHE", cache=cache, output_unit=calibrate_output_unit
                            )

                    inst_shindo_3c = _compute_inst_shindo_3c(
                        points_n=p_n,
                        points_e=p_e,
                        points_z=points_eff,
                        total_window_ms=window_ms or 180_000,
                        unit=unit_eff,
                    )

                # Acceleration points (best-effort) for plotting/analysis
                points_acc, unit_acc, accel_meta = _derive_accel_points_from_velocity_points(
                    points_eff,
                    unit_velocity=unit_eff,
                    freqmin=0.5,
                    freqmax=5.0,
                )

                payload = {
                    "net": net,
                    "sta": sta,
                    "chan": chan,
                    "mode": mode,
                    "unit": unit_eff,
                    "unit_raw": unit_raw,
                    "calibration": calibration,
                    "points": points_eff,
                    "points_acc": points_acc,
                    "unit_acc": unit_acc,
                    "accel": accel_meta,
                    "shake": _compute_shake(points_eff, window_ms),
                    "shindo_est": _estimate_shindo(points_eff, window_ms),
                    "inst_shindo_3c": inst_shindo_3c,
                }
                _atomic_write_json(out_path, payload)
                st.last_write = now

        time.sleep(0.2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Follow a directory of per-station miniSEED files and export per-station JSON for kanameishi")
    parser.add_argument("--in-dir", type=Path, required=True, help="Directory containing per-station .mseed files")
    parser.add_argument("--out-dir", type=Path, required=True, help="Output directory for per-station JSON files")
    parser.add_argument("--mode", choices=["pga", "waveform"], default="waveform")
    parser.add_argument("--every", type=int, default=1, help="For waveform mode: keep every Nth sample")
    parser.add_argument("--max-points", type=int, default=2000, help="Keep last N points per station (0=unlimited)")
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--assume-unit", type=str, default="counts")
    parser.add_argument("--interval", type=float, default=1.0, help="Per-station JSON update interval (seconds)")
    parser.add_argument("--window-sec", type=int, default=180, help="Keep only last N seconds of data in each JSON (0=disable)")
    parser.add_argument(
        "--calibrate-stationxml",
        action="store_true",
        help="If assume-unit is counts, try to remove response using IRIS StationXML and export calibrated velocity.",
    )
    parser.add_argument(
        "--calibrate-output-unit",
        type=str,
        default="um/s",
        help="Velocity unit after calibration: um/s (default), cm/s, or m/s.",
    )
    args = parser.parse_args()

    follow_dir(
        in_dir=args.in_dir,
        out_dir=args.out_dir,
        interval_sec=args.interval,
        mode=args.mode,
        every=args.every,
        max_points=args.max_points,
        scale=args.scale,
        unit=args.assume_unit,
        window_sec=args.window_sec,
        calibrate_stationxml=bool(args.calibrate_stationxml),
        calibrate_output_unit=str(args.calibrate_output_unit),
    )


if __name__ == "__main__":
    main()
