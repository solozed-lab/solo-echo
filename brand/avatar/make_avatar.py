#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
九月 Silas · 头像精确稿生成器 v2
—————————————————————————————————————————————————
品牌令牌（全部取自 solozed.com 的 site/assets/css/theme.css，不新增颜色）：
  底色 #05070f  主色 #ffb765  高光 #eaf6ff  次级 #8fa6c4
  禁用大面积：#4de3ff（青） #a06bff（紫）

做法：1200×1200 超采样 → LANCZOS 缩到 300 / 800。
形状由骨架点 + Catmull-Rom 样条 + 变宽笔触定义，数学上可控，不会画歪。
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
S = 4
W = 300
C = W * S

BG_EDGE = (4, 6, 13)
BG_CENTER = (11, 17, 32)
GOLD = (255, 183, 101)      # --sw-gold
INK = (234, 246, 255)       # --sw-ink

# S 的骨架点（设计单位 0..1，y 向下）：
# 起点在右上，向左卷过顶部，沿左侧下行，中部向右穿过，右下再向左收笔到左下。
# 这是标准 S 的走向（不是镜像的 Ƨ）。
S_SKELETON = [
    (0.80, 0.13), (0.52, 0.03), (0.24, 0.17), (0.30, 0.38),
    (0.62, 0.53), (0.78, 0.69), (0.52, 0.96), (0.22, 0.86),
]


# ----------------------------------------------------------------- 基础件
def catmull_rom(pts, per_seg=140):
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        for j in range(per_seg):
            t = j / per_seg
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t +
                       (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 +
                       (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t +
                       (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 +
                       (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x, y))
    out.append(pts[-1])
    return out


def place(skel, ox, oy, sx, sy):
    return [(ox + x * sx, oy + y * sy) for x, y in skel]


def make_bg():
    small = Image.new("RGB", (150, 150))
    px = small.load()
    c = 74.5
    maxr = math.hypot(c, c)
    for y in range(150):
        for x in range(150):
            r = math.hypot(x - c, y - c) / maxr
            t = (1.0 - r) ** 1.25
            px[x, y] = tuple(int(BG_EDGE[i] + (BG_CENTER[i] - BG_EDGE[i]) * t) for i in range(3))
    img = small.resize((C, C), Image.BICUBIC)

    glow = Image.new("L", (150, 150), 0)
    gp = glow.load()
    for y in range(150):
        for x in range(150):
            r = math.hypot(x - c, y - c) / maxr
            gp[x, y] = int(24 * max(0.0, 1.0 - r * 1.6) ** 2)
    glow = glow.resize((C, C), Image.BICUBIC)
    return Image.composite(Image.new("RGB", (C, C), (96, 64, 34)), img, glow)


def tapered_stroke(draw, pts, wmax, floor=0.30, color=GOLD, wobble=0.0):
    """一笔有粗细变化的笔触：两端细、中间粗。"""
    n = len(pts) - 1
    for i, (x, y) in enumerate(pts):
        t = i / n
        prof = floor + (1 - floor) * (math.sin(math.pi * t) ** 0.55)
        r = (wmax / 2) * prof
        if r < 0.35:
            continue
        if wobble:
            x += wobble * math.sin(t * 7.3)
            y += wobble * 0.6 * math.sin(t * 5.1 + 1.2)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def crescent(img, cx, cy, r, color=GOLD, off=(0.42, -0.30), cut=0.94):
    m = Image.new("L", (C, C), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    k = r * cut
    d.ellipse([cx - k + off[0]*r, cy - k + off[1]*r,
               cx + k + off[0]*r, cy + k + off[1]*r], fill=0)
    img.paste(Image.new("RGB", (C, C), color), (0, 0), m)


def wave(draw, x0, x1, y, amp, cycles, wmax, taper=0.75, color=GOLD, phase=0.0):
    """一道水波：振幅与粗细都往下游衰减。"""
    n = 900
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        yy = y + amp * math.sin(t * cycles * 2 * math.pi + phase) * (1 - t * 0.5)
        r = (wmax / 2) * (1 - t * taper) ** 1.1 + 0.7
        draw.ellipse([x - r, yy - r, x + r, yy + r], fill=color)


def s_shape(img, ox, oy, sx, sy, wmax=24, wobble=1.2):
    """骨架点是 0..1 设计单位 → 先放到 0..300 画布坐标 → 再乘超采样倍率。"""
    d = ImageDraw.Draw(img)
    pts = catmull_rom(place(S_SKELETON, ox, oy, sx, sy))
    pts = [(x * W * S, y * W * S) for x, y in pts]
    tapered_stroke(d, pts, wmax * S, floor=0.26, wobble=wobble * S * 0.1)
    return pts


# ----------------------------------------------------------------- 五个变体
def v_s_moon():
    """01 一笔 S + 月相 —— 收笔化成新月的方向（推荐）
    构图沿用 AI 草图里最顺的那张：S 在左上占主体，月亮独立在右下，不与笔画打架。"""
    img = make_bg()
    s_shape(img, 0.13, 0.12, 0.50, 0.62, wmax=23)
    crescent(img, 0.705 * W * S, 0.725 * W * S, 0.105 * W * S,
             off=(0.44, -0.30), cut=0.95)
    return img


def v_s_ripple():
    """02 一笔 S + 水波 —— S 悬在水线之上"""
    img = make_bg()
    s_shape(img, 0.18, 0.08, 0.50, 0.58, wmax=23)
    d = ImageDraw.Draw(img)
    wave(d, 48 * S, 240 * S, 213 * S, 5 * S, 2.0, 8 * S, taper=0.70)
    return img


def v_s_plain():
    """03 纯一笔 S —— 小尺寸最稳"""
    img = make_bg()
    s_shape(img, 0.22, 0.14, 0.56, 0.68, wmax=26)
    return img


def v_moon_line():
    """04 半月 + 一线 —— 极简抽象"""
    img = make_bg()
    crescent(img, 150 * S, 112 * S, 54 * S, off=(0.42, -0.30), cut=0.95)
    d = ImageDraw.Draw(img)
    wave(d, 78 * S, 222 * S, 216 * S, 0, 0, 10 * S, taper=0.38)
    return img


def v_teacup():
    """05 茶盏 —— 方案 A 的物件版（加把手才像杯子，不然像垃圾桶）"""
    img = make_bg()
    d = ImageDraw.Draw(img)
    # 茶托（扁平椭圆）—— 画在最底层
    d.ellipse([70 * S, 216 * S, 230 * S, 248 * S], fill=GOLD)
    # 杯身
    d.polygon([(x * S, y * S) for x, y in
               [(100, 128), (200, 128), (188, 210), (112, 210)]], fill=GOLD)
    d.ellipse([112 * S, 186 * S, 188 * S, 234 * S], fill=GOLD)
    # 杯口：深色细缝 = 开口
    d.ellipse([98 * S, 116 * S, 202 * S, 140 * S], fill=BG_CENTER)
    d.ellipse([103 * S, 119 * S, 197 * S, 137 * S], fill=GOLD)
    # 把手：右半侧圆弧，画在杯身之后才看得见（弧向必须朝右）
    hp = [(194 + 30 * math.sin(math.pi * i / 40), 138 + 46 * i / 40)
          for i in range(41)]
    tapered_stroke(d, [(x * S, y * S) for x, y in hp], 10 * S, floor=0.9)
    # 热气
    st = catmull_rom([(150, 106), (136, 86), (166, 64), (150, 36)])
    tapered_stroke(d, [(x * S, y * S) for x, y in st], 7 * S, floor=0.16)
    return img


VARIANTS = [
    ("01-s-moon", "一笔 S + 月相", v_s_moon),
    ("02-s-ripple", "一笔 S + 水波", v_s_ripple),
    ("03-s-plain", "纯一笔 S", v_s_plain),
    ("04-moon-line", "半月 + 一线", v_moon_line),
    ("05-teacup", "茶盏", v_teacup),
]


# ----------------------------------------------------------------- 输出
def circle_crop(img, size):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGB", (size, size), (255, 255, 255))
    out.paste(img.resize((size, size), Image.LANCZOS), (0, 0), m)
    return out


def font(sz, cjk=False):
    if cjk:
        for p in ("/System/Library/Fonts/Hiragino Sans GB.ttc",
                  "/System/Library/Fonts/STHeiti Medium.ttc"):
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, sz, index=0)
                except Exception:
                    pass
    try:
        return ImageFont.load_default(size=sz)
    except TypeError:
        return ImageFont.load_default()


def build_sheet(masters, dark=False):
    """自检表：300 预览 / 圆形裁切 92 / 圆形裁切 48 / 96 / 48 / 32 / 标注"""
    W_, ROW = 1180, 300
    H_ = ROW * len(VARIANTS) + 70
    bg = (18, 20, 26) if dark else (255, 255, 255)
    fg = (150, 165, 190) if dark else (40, 44, 52)
    sheet = Image.new("RGB", (W_, H_), bg)
    d = ImageDraw.Draw(sheet)
    d.text((24, 20), ("DARK LIST (Xiaohongshu / Douyin dark)" if dark
                      else "LIGHT LIST (Bilibili / YouTube white)"),
           fill=fg, font=font(17, True))
    for r, (name, cn, _) in enumerate(VARIANTS):
        y = 70 + r * ROW
        img = masters[name].resize((300, 300), Image.LANCZOS)
        sheet.paste(img, (24, y))
        sheet.paste(circle_crop(img, 92), (348, y + 4))
        sheet.paste(circle_crop(img, 48), (464, y + 26))
        x = 540
        for sz in (96, 48, 32):
            sheet.paste(img.resize((sz, sz), Image.LANCZOS), (x, y + (92 - sz) // 2))
            x += sz + 28
        d.text((x + 8, y + 40), f"{cn}\n{name}", fill=fg, font=font(16, True))
    return sheet


def main():
    masters = {}
    for name, _, fn in VARIANTS:
        m = fn()
        masters[name] = m
        m.resize((800, 800), Image.LANCZOS).save(os.path.join(OUT, f"silas-avatar-{name}-800.png"))
        m.resize((300, 300), Image.LANCZOS).save(os.path.join(OUT, f"silas-avatar-{name}-300.png"))
        m.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, f"silas-avatar-{name}-64.png"))
        print("rendered", name)

    # 总览
    sheet = Image.new("RGB", (5 * 300 + 6 * 24, 300 + 78), (12, 14, 20))
    d = ImageDraw.Draw(sheet)
    for i, (name, cn, _) in enumerate(VARIANTS):
        x = 24 + i * (300 + 24)
        sheet.paste(masters[name].resize((300, 300), Image.LANCZOS), (x, 12))
        d.text((x + 2, 324), f"{name}  {cn}", fill=(150, 165, 190), font=font(16, True))
    sheet.save(os.path.join(OUT, "silas-avatar-variants.png"))

    build_sheet(masters, dark=False).save(os.path.join(OUT, "silas-avatar-testsheet-light.png"))
    build_sheet(masters, dark=True).save(os.path.join(OUT, "silas-avatar-testsheet-dark.png"))
    print("done ->", OUT)


if __name__ == "__main__":
    main()
