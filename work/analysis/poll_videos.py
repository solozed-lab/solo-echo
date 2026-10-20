#!/usr/bin/env python3
"""Poll the 9 video tasks, download them, and encode web-ready mp4s.

Outputs
  site/assets/vid/<key>.mp4      1280x720, crf21, -g 8, +faststart, no audio (desktop)
  site/assets/vid/m_<key>.mp4    720x406,  -g 4, +faststart, no audio (phone)
  site/assets/img/poster_<key>.jpg  first frame, matches the clip exactly
"""
import json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "work" / "analysis" / "video_tasks.json"
RAW = ROOT / "work" / "raw"
VID = ROOT / "site" / "assets" / "vid"
IMG = ROOT / "site" / "assets" / "img"

DEADLINE = time.time() + 900


def run(cmd, timeout=600):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


def query(task_id, model):
    rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__query_video_generation",
                        "--args", json.dumps({"task_id": task_id, "model": model})], timeout=180)
    if rc != 0:
        return None, f"rc={rc} {err[-160:]}"
    try:
        s = out[out.find("{"):out.rfind("}") + 1]
        return json.loads(s), None
    except Exception as e:
        return None, f"parse: {e} :: {out[-200:]}"


def encode(key, src):
    dest = VID / f"{key}.mp4"
    mob = VID / f"m_{key}.mp4"
    poster = IMG / f"poster_{key}.jpg"
    common = ["-an", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
              "-movflags", "+faststart", "-an"]
    # desktop master
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src),
           "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=24",
           "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "21",
           "-g", "8", "-keyint_min", "8", "-sc_threshold", "0", "-movflags", "+faststart",
           "-an", str(dest)]
    rc, out, err = run(cmd)
    if rc != 0:
        return f"encode {key} failed: {err[-300:]}"
    # mobile (tighter GOP -> smoother phone scrubbing)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src),
           "-vf", "scale=854:480:force_original_aspect_ratio=increase,crop=854:480,fps=24",
           "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "24",
           "-g", "4", "-keyint_min", "4", "-sc_threshold", "0", "-movflags", "+faststart",
           "-an", str(mob)]
    rc, out, err = run(cmd)
    if rc != 0:
        print(f"  mobile encode failed for {key}: {err[-160:]}", flush=True)
    # poster = exact first frame of the clip
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-frames:v", "1",
         "-vf", "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900",
         "-q:v", "4", str(poster)])
    return None


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    VID.mkdir(parents=True, exist_ok=True)
    tasks = json.loads(TASKS.read_text())
    pending = dict(tasks)
    done = {}
    failures = {}

    while pending and time.time() < DEADLINE:
        for key in list(pending):
            info = pending[key]
            data, err = query(info["task_id"], info["model"])
            if data is None:
                print(f"[{key}] query error: {err}", flush=True)
                continue
            status = data.get("status") or data.get("state")
            if status in ("succeeded", "success", "completed"):
                url = data.get("video_url") or data.get("url")
                if not url:
                    failures[key] = f"succeeded but no url: {json.dumps(data)[:200]}"
                    pending.pop(key, None)
                    continue
                raw = RAW / f"{key}.mp4"
                rc, out, err = run(["curl", "-sL", url, "-o", str(raw)])
                if rc != 0 or not raw.exists() or raw.stat().st_size < 1000:
                    failures[key] = f"download failed: {err[-160:]}"
                    pending.pop(key, None)
                    continue
                e = encode(key, raw)
                if e:
                    failures[key] = e
                    print(f"[{key}] {e}", flush=True)
                else:
                    size = (VID / f"{key}.mp4").stat().st_size
                    print(f"[{key}] done  {size//1024} KB  (poster extracted)", flush=True)
                    done[key] = str(VID / f"{key}.mp4")
                pending.pop(key, None)
            elif status in ("failed", "cancelled", "error"):
                failures[key] = json.dumps(data)[:300]
                print(f"[{key}] FAILED: {failures[key]}", flush=True)
                pending.pop(key, None)
            else:
                print(f"[{key}] {status}...", flush=True)
        if pending:
            time.sleep(20)

    print("\n=== SUMMARY ===")
    for k in tasks:
        if k in done:
            print(f"  OK       {k}  {done[k]}")
        else:
            print(f"  MISSING  {k}  {failures.get(k, 'timeout / still running')}")
    (ROOT / "work" / "analysis" / "video_result.json").write_text(
        json.dumps({"done": done, "failed": failures}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
