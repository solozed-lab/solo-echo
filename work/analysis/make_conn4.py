#!/usr/bin/env python3
"""补一段连接转场 conn4（万物 → 加入）。六章结构需要 5 段连接转场。"""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAWDIR = ROOT / "work" / "raw"
VIDDIR = ROOT / "site" / "assets" / "vid"

PROMPT = ("The camera pulls out of a vast glowing network of particles until the whole web fills the "
          "frame, then a single bright point of light ignites at the center and everything begins to "
          "flow toward it. Continuous forward motion, deep space blue-black background, volumetric "
          "light, teal-cyan and violet accents, high contrast cinematic render, no text, no watermark, "
          "no human faces, no logos")


def run(cmd, timeout=600):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


def parse_json(t):
    return json.loads(t[t.find("{"):t.rfind("}") + 1])


args = {"model": "MiniMax-Hailuo-2.3", "prompt": PROMPT, "duration": 6, "resolution": "768P"}
rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__submit_video_generation",
                     "--args", json.dumps(args)])
if rc != 0:
    print("submit failed:", err[-300:]); sys.exit(1)
task_id = parse_json(out)["task_id"]
print("conn4 task:", task_id, flush=True)

deadline = time.time() + 600
while time.time() < deadline:
    time.sleep(15)
    rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__query_video_generation",
                         "--args", json.dumps({"task_id": task_id, "model": "MiniMax-Hailuo-2.3"})])
    v = parse_json(out)
    st = v.get("status")
    print("status:", st, flush=True)
    if st in ("succeeded", "success", "completed"):
        url = v.get("video_url") or v.get("url")
        raw = RAWDIR / "conn4.mp4"
        run(["curl", "-sL", url, "-o", str(raw)])
        run(["ffmpeg", "-y", "-v", "error", "-i", str(raw),
             "-vf", "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=24",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "28",
             "-preset", "slower", "-g", "8", "-keyint_min", "8", "-sc_threshold", "0",
             "-movflags", "+faststart", "-an", str(VIDDIR / "conn4.mp4")])
        run(["ffmpeg", "-y", "-v", "error", "-i", str(raw),
             "-vf", "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=24",
             "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "29",
             "-preset", "slower", "-g", "4", "-keyint_min", "4", "-sc_threshold", "0",
             "-movflags", "+faststart", "-an", str(VIDDIR / "m_conn4.mp4")])
        run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-frames:v", "1",
             "-vf", "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900",
             "-q:v", "4", str(ROOT / "site" / "assets" / "img" / "poster_conn4.jpg")])
        print("DONE conn4", (VIDDIR / "conn4.mp4").stat().st_size, "bytes")
        break
    if st in ("failed", "cancelled", "error"):
        print("failed:", json.dumps(v)[:300]); sys.exit(1)
