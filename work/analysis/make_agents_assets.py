#!/usr/bin/env python3
"""为「AI 与 AI」章节生成新素材：关键帧（紫/品红双格栅互发信号）→ 图生视频。

原来的 human.mp4 是给「人与人」做的金色暖群，概念改正后不再匹配，
这一章换成机器之间互相发信号的冷感画面。
"""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMGDIR = ROOT / "site" / "assets" / "img"
VIDDIR = ROOT / "site" / "assets" / "vid"
RAWDIR = ROOT / "work" / "raw"

PROMPT = (
    "Two precise geometric lattices of violet and magenta light facing each other in a dark void, "
    "exchanging streams of luminous particles between them, nodes firing signals back and forth, "
    "a third lattice forming where the two streams meet, machine-like symmetry, cold electric glow, "
    "deep space blue-black background, volumetric light, high contrast cinematic render, "
    "slow camera drift, no text, no watermark, no human faces, no logos"
)
STYLE = (
    "deep space blue-black background #05070f, violet #a06bff and magenta #ff7bd5 accents, "
    "volumetric light, high contrast, subtle film grain, no text, no watermark, no human faces, no logos"
)


def run(cmd, timeout=600):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout, p.stderr


def parse_json(text):
    s = text[text.find("{"):text.rfind("}") + 1]
    return json.loads(s)


def main():
    RAWDIR.mkdir(parents=True, exist_ok=True)
    VIDDIR.mkdir(parents=True, exist_ok=True)

    # 1) 关键帧
    args = {"requests": [{
        "prompt": PROMPT + ". STYLE: " + STYLE,
        "aspect_ratio": "16:9", "resolution": "1K", "output_file": "key_agents.jpg"
    }]}
    rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__generate_image",
                         "--args", json.dumps(args)])
    if rc != 0:
        print("keyframe failed:", err[-300:]); sys.exit(1)
    data = parse_json(out)
    items = data.get("success_items") or []
    if not items:
        print("keyframe failed:", out[-400:]); sys.exit(1)
    node_id = items[0]["node_id"]
    print("keyframe node:", node_id, flush=True)

    rc, out, err = run(["mcode-tools", "get_asset_url", node_id])
    url = parse_json(out)["download_url"]
    rc, out, err = run(["curl", "-sL", url, "-o", str(IMGDIR / "key_agents.jpg")])
    print("keyframe saved:", (IMGDIR / "key_agents.jpg").stat().st_size, "bytes", flush=True)

    # 归一成 1600x900 JPEG
    run(["ffmpeg", "-y", "-v", "error", "-i", str(IMGDIR / "key_agents.jpg"),
         "-vf", "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900",
         "-q:v", "4", str(IMGDIR / "key_agents.tmp.jpg")])
    (IMGDIR / "key_agents.tmp.jpg").replace(IMGDIR / "key_agents.jpg")

    # 2) 图生视频
    rc, out, err = run(["mcode-tools", "get_asset_url", node_id])
    url = parse_json(out)["download_url"]
    vargs = {
        "model": "MiniMax-Hailuo-2.3",
        "prompt": "Two geometric lattices of violet and magenta light exchange streams of luminous "
                  "particles in a dark void, nodes firing signals back and forth, a third lattice "
                  "forming where they meet. " + STYLE,
        "input_image": {"url": url, "mime_type": "image/jpeg"},
        "reference_type": "first_frame",
        "duration": 6,
        "resolution": "768P"
    }
    rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__submit_video_generation",
                         "--args", json.dumps(vargs)])
    if rc != 0:
        print("submit failed:", err[-300:]); sys.exit(1)
    vdata = parse_json(out)
    task_id = vdata.get("task_id")
    print("video task:", task_id, flush=True)

    # 3) 轮询
    deadline = time.time() + 600
    while time.time() < deadline:
        time.sleep(15)
        rc, out, err = run(["mcode-tools", "connector", "call", "connector__matrix__query_video_generation",
                             "--args", json.dumps({"task_id": task_id, "model": "MiniMax-Hailuo-2.3"})])
        v = parse_json(out)
        st = v.get("status")
        print("status:", st, flush=True)
        if st in ("succeeded", "success", "completed"):
            vurl = v.get("video_url") or v.get("url")
            raw = RAWDIR / "agents.mp4"
            run(["curl", "-sL", vurl, "-o", str(raw)])
            # 桌面版
            run(["ffmpeg", "-y", "-v", "error", "-i", str(raw),
                 "-vf", "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=24",
                 "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "28",
                 "-preset", "slower", "-g", "8", "-keyint_min", "8", "-sc_threshold", "0",
                 "-movflags", "+faststart", "-an", str(VIDDIR / "agents.mp4")])
            # 手机版
            run(["ffmpeg", "-y", "-v", "error", "-i", str(raw),
                 "-vf", "scale=960:540:force_original_aspect_ratio=increase,crop=960:540,fps=24",
                 "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "29",
                 "-preset", "slower", "-g", "4", "-keyint_min", "4", "-sc_threshold", "0",
                 "-movflags", "+faststart", "-an", str(VIDDIR / "m_agents.mp4")])
            # poster = 片段首帧
            run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-frames:v", "1",
                 "-vf", "scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900",
                 "-q:v", "4", str(IMGDIR / "poster_agents.jpg")])
            print("DONE agents.mp4", (VIDDIR / "agents.mp4").stat().st_size, "bytes", flush=True)
            return
        if st in ("failed", "cancelled", "error"):
            print("video failed:", json.dumps(v)[:300]); sys.exit(1)
    print("timeout")


if __name__ == "__main__":
    main()
