#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 生图候选对比表（纯生图，不用代码画形）
用法: python3 make_ai_sheet.py <输出名> <图片1> <图片2> ...
每格 = 300px 预览 + 圆形裁切 84 + 圆形裁切 48 + 48px + 32px
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))


def font(sz, cjk=True):
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


def circle_crop(img, size, bg):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGB", (size, size), bg)
    out.paste(img.resize((size, size), Image.LANCZOS), (0, 0), m)
    return out


def build(paths, out_name, dark=False, cols=6):
    CW, CH = 316, 440
    rows = (len(paths) + cols - 1) // cols
    W = CW * cols + 24
    H = CH * rows + 86
    bg = (16, 18, 24) if dark else (252, 252, 253)
    fg = (152, 166, 190) if dark else (38, 42, 50)
    cb = bg if dark else (255, 255, 255)
    sheet = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(sheet)
    d.text((20, 18), "AI 生图候选 · 深色列表（小红书/抖音深色）" if dark
           else "AI 生图候选 · 浅色列表（B站/油管白底）", fill=fg, font=font(19))
    d.text((20, 46), "每格：300px 预览 / 圆形裁切 84 / 圆形裁切 48 / 48px / 32px",
           fill=fg, font=font(15))
    for i, p in enumerate(paths):
        r, c = divmod(i, cols)
        x = 20 + c * CW
        y = 86 + r * CH
        im = Image.open(p).convert("RGB").resize((300, 300), Image.LANCZOS)
        sheet.paste(im, (x, y))
        sy = y + 308
        sheet.paste(circle_crop(im, 84, cb), (x, sy))
        sheet.paste(circle_crop(im, 48, cb), (x + 96, sy + 18))
        for j, sz in enumerate((48, 32)):
            sheet.paste(im.resize((sz, sz), Image.LANCZOS), (x + 162 + j * 60, sy + 18))
        d.text((x, y + 398), os.path.basename(p).rsplit(".", 1)[0],
               fill=fg, font=font(14))
    sheet.save(os.path.join(OUT, out_name))
    print("saved", out_name)


if __name__ == "__main__":
    name = sys.argv[1]
    files = sys.argv[2:]
    build(files, name + "-light.png", dark=False)
    build(files, name + "-dark.png", dark=True)
