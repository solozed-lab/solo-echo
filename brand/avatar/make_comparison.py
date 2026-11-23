#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
最终候选对比表：代码精确稿 vs AI 草图
每格 = 300px 预览 + 圆形裁切 96 + 圆形裁切 48 + 原尺寸 48 / 32
输出 silas-avatar-final-light.png / silas-avatar-final-dark.png
"""
import os
import glob
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(OUT, "ai-drafts")

CODE = [("01-s-moon", "一笔 S + 月相"), ("02-s-ripple", "一笔 S + 水波"),
        ("03-s-plain", "纯一笔 S"), ("04-moon-line", "半月 + 一线"),
        ("05-teacup", "茶盏")]
AI = [("silas-avatar-01-s-moon.jpg", "AI 01 S+月相"),
      ("silas-avatar-02-s-ripple.jpg", "AI 02 S+水波"),
      ("silas-avatar-03-teacup.jpg", "AI 03 茶盏"),
      ("silas-avatar-04-desklamp.jpg", "AI 04 台灯"),
      ("silas-avatar-05-moon-line.png", "AI 05 半月+线")]


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


def circle_crop(img, size, bg=(255, 255, 255)):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new("RGB", (size, size), bg)
    out.paste(img.resize((size, size), Image.LANCZOS), (0, 0), m)
    return out


def build(dark=False):
    CW, CH = 316, 440
    W = CW * 5 + 24
    H = CH * 2 + 86
    bg = (16, 18, 24) if dark else (252, 252, 253)
    fg = (152, 166, 190) if dark else (38, 42, 50)
    sheet = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(sheet)
    d.text((20, 18), "候选对比 · 深色列表（小红书/抖音深色）" if dark
           else "候选对比 · 浅色列表（B站/油管白底）", fill=fg, font=font(19))
    d.text((20, 46), "代码精确稿（矢量渲染，可无限放大）", fill=fg, font=font(16))

    def row(y, items, title):
        d.text((20, y - 26), title, fill=fg, font=font(16))
        cb = (255, 255, 255) if not dark else (16, 18, 24)
        for i, (path, label) in enumerate(items):
            x = 20 + i * CW
            im = Image.open(path).convert("RGB").resize((300, 300), Image.LANCZOS)
            sheet.paste(im, (x, y))
            sy = y + 308
            sheet.paste(circle_crop(im, 84, cb), (x, sy))
            sheet.paste(circle_crop(im, 48, cb), (x + 96, sy + 18))
            for j, sz in enumerate((48, 32)):
                sheet.paste(im.resize((sz, sz), Image.LANCZOS), (x + 162 + j * 60, sy + 18))
            d.text((x, y + 398), label, fill=fg, font=font(15))

    row(86, [(os.path.join(OUT, f"silas-avatar-{n}-300.png"), lab) for n, lab in CODE],
        "代码精确稿（矢量渲染，可无限放大）")
    row(86 + CH, [(os.path.join(A, n), lab) for n, lab in AI], "AI 草图（matrix 出图，有笔锋但不可控）")
    return sheet


if __name__ == "__main__":
    build(False).save(os.path.join(OUT, "silas-avatar-final-light.png"))
    build(True).save(os.path.join(OUT, "silas-avatar-final-dark.png"))
    print("ok")
