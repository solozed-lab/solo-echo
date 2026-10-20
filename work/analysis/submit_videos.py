#!/usr/bin/env python3
"""Submit the video layer for scroll-world: 5 chapter dives + 4 connector fly-overs.

Dives  = image-to-video, first frame = the generated keyframe (style continuity).
Connectors = text-to-video "light travelling through the network" transitions.

Writes work/analysis/video_tasks.json so the poller can pick up task_ids.
"""
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "work" / "analysis" / "video_tasks.json"

IMAGES = {
    "origin": "454352085546012",
    "ai": "454352374624965",
    "human": "454351787679870",
    "mesh": "454352185286873",
    "join": "454352472305741",
}

STYLE = ("deep space blue-black background, volumetric light, teal-cyan #4de3ff and violet "
         "#a06bff with warm gold accents, high contrast cinematic render, slow deliberate camera, "
         "no text, no watermark, no human faces, no logos")

DIVE_PROMPTS = {
    "origin": ("Slow cinematic push forward into an immense field of glowing particles. Nodes ignite "
               "one after another and thin light filaments propagate outward like a network waking up. "
               "Drifting luminous dust, gentle parallax. " + STYLE),
    "ai": ("Two distinct streams of glowing particles drift toward each other and interlace: one cool cyan "
           "and geometric, one violet and organic. Thin light filaments bridge them where they meet, a bright "
           "nexus forms at center. Slow lateral camera drift. " + STYLE),
    "human": ("A warm golden swarm of glowing particles rotates gently around its center, delicate threads of "
              "light link node to node, soft amber bloom spreading outward, dense organic constellation. "
              "Slow orbital camera move. " + STYLE),
    "mesh": ("Camera steadily pulls back to reveal a colossal spherical mesh made of thousands of glowing nodes "
             "and light filaments, curving away into deep perspective like a planet made of pure connection. "
             "Slow awe-inspiring retreat. " + STYLE),
    "join": ("Glowing particles converge and organize into a luminous archway gateway of light in a dark void, "
             "threads of energy flowing into the opening, calm and inviting. Camera slowly approaches the "
             "opening and settles. " + STYLE),
}

CONNECTOR_PROMPTS = [
    ("conn0", "A wave of light travels through a dark field of glowing particles, streaking along connection "
              "lines from the left edge toward the right, revealing new nodes as it passes. Continuous forward "
              "motion. " + STYLE),
    ("conn1", "A luminous shockwave expands through a sparse particle network, pushing particles outward and "
              "igniting new connection lines in its wake. Continuous forward motion. " + STYLE),
    ("conn2", "Streams of fine light particles stream diagonally across a dark void, weaving through a faint "
              "network and pulling thin luminous threads behind them. Continuous forward motion. " + STYLE),
    ("conn3", "The camera flies through a tunnel of glowing nodes and light filaments, the network opening "
              "outward ahead. Continuous forward motion. " + STYLE),
]

# MiniMax-H3 / H3-Max bill to account credits (balance insufficient), while
# MiniMax-Hailuo-2.3 is Token-Plan eligible -> use it for this build.
MODEL = "MiniMax-Hailuo-2.3"
DURATION = 6
# already submitted before the model switch, reuse it instead of paying twice
EXISTING = {"origin": "454353428926730"}


def run(cmd, timeout=180):
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.stdout, p.stderr, p.returncode


def parse_json(text):
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no json in: " + text[:300])
    return json.loads(text[start:end + 1])


def asset_url(node_id):
    out, err, rc = run(["mcode-tools", "get_asset_url", node_id])
    if rc != 0:
        raise RuntimeError(f"get_asset_url failed for {node_id}: {err[-200:]}")
    return parse_json(out)["download_url"]


def submit(args):
    out, err, rc = run(["mcode-tools", "connector", "call", "connector__matrix__submit_video_generation",
                         "--args", json.dumps(args)], timeout=300)
    if rc != 0:
        raise RuntimeError(f"submit failed: {err[-400:]} {out[-200:]}")
    data = parse_json(out)
    if isinstance(data, dict) and "task_id" in data:
        return data["task_id"]
    # some versions nest it
    for k in ("data", "result", "task"):
        if isinstance(data.get(k), dict) and "task_id" in data[k]:
            return data[k]["task_id"]
    raise RuntimeError("no task_id in: " + json.dumps(data)[:400])


def main():
    tasks = {}
    for key, node_id in IMAGES.items():
        if key in EXISTING:
            tasks[key] = {"kind": "dive", "task_id": EXISTING[key], "model": MODEL}
            print(f"[dive] {key}: {EXISTING[key]} (reused)", flush=True)
            continue
        url = asset_url(node_id)
        mime = "image/png" if key == "mesh" else "image/jpeg"
        args = {
            "model": MODEL,
            "prompt": DIVE_PROMPTS[key],
            "input_image": {"url": url, "mime_type": mime},
            "reference_type": "first_frame",
            "duration": DURATION,
            "resolution": "768P",
        }
        tid = submit(args)
        tasks[key] = {"kind": "dive", "task_id": tid, "model": MODEL}
        print(f"[dive] {key}: {tid}", flush=True)
        time.sleep(0.4)

    for key, prompt in CONNECTOR_PROMPTS:
        args = {
            "model": MODEL,
            "prompt": prompt,
            "duration": DURATION,
            "resolution": "768P",
        }
        tid = submit(args)
        tasks[key] = {"kind": "conn", "task_id": tid, "model": MODEL}
        print(f"[conn] {key}: {tid}", flush=True)
        time.sleep(0.4)

    OUT.write_text(json.dumps(tasks, ensure_ascii=False, indent=2))
    print(f"\nwrote {OUT} ({len(tasks)} tasks)")


if __name__ == "__main__":
    main()
