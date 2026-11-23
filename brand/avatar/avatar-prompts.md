# 九月 Silas · 头像提示词包 v2（纯生图路线）

> 结论先行：**墨色底 + 一笔手写的 S，S 收笔处化成一枚小月牙**。
> 主色取站点已有的暖金 `#ffb765`，不新造颜色。
>
> 全部候选均由 **AI 生图**产出（matrix 文生图 + 图生图精修），未用代码画形。
> 提示词原文：`gen-args.json`（第一轮）/ `gen-args-round2.json`（第二轮）/ `gen-args-i2i.json`（图生图）

---

## 0. 一处跟原方案不同的判断：主色不用青色

原方案说「别用蓝紫渐变，那是工具号的制服」——方向对，但**不能直接套到头像上**，
因为 `solozed.com` 这个品牌站本身就是深空 + 青色（`--sw-cyan: #4de3ff`）的宇宙叙事。
如果头像另起一套色板，它和站点就是两个品牌；如果直接用青色当主色，头像会在
B 站/油管列表里读成「又一个 AI 工具号」。

解法不是新造颜色，是**从站点已有令牌里换一个当主角**：

| 角色 | 取值 | 来源 | 说明 |
|---|---|---|---|
| 底色 | `#05070f` | 站点 `--sw-bg` | 深空蓝黑，跟站点同源 |
| 主色 | `#ffb765` | 站点 `--sw-gold` | 暖金 / 秋调，「九月」的时间感 |
| 图形高光 | `#eaf6ff` | 站点 `--sw-ink` | 冷白，只用于极小面积 |
| 次级 | `#8fa6c4` | 站点 `--sw-ink-soft` | 辅助线、极小字 |
| 禁用 | `#4de3ff` `#a06bff` | 站点青/紫 | 大面积使用会读成科技号 |

**零新增令牌。** 头像是站点的第 6 个切面，不是第二个品牌。
青色和紫色留在站内（那是「关系/宇宙」的世界观），头像只带走秋天的金和一个人名。

---

## 1. 为什么是「一笔 S + 月相」

- **S** 是 Silas 的第一个音节，天然是字母也是图形，缩到 48px 还剩一条有识别度的曲线。
- **一笔**（不断笔）= 手写感 = 人味；纯几何的 S 会像输入法 logo。
- **月相** = 「九月」的时间感 + 「慢下来」的意象，同时补上 S 收笔处的形。
- 两个信息压进一个笔画：名字里的时间 + 名字里的人。

---

## 2. 通用负向词（每次都带上）

```
Absolutely no text, no letters, no words, no typography, no logo, no watermark,
no border, no frame, no extra objects, no stars, no hands, no person,
no gradient mesh, no glow bloom, no 3D, no photorealism, no texture, no grain, no blur
```

> 即梦/豆包就算加了这段也会自己塞装饰字和小标签，出了图用「消除」工具擦掉一次就行。

---

## 3. 五条主提示词（即梦/豆包中文版 + 通用英文版）

### P1 「一笔 S + 月相」 ★ 首推

**即梦 / 豆包（中文）**
```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
画面中央是一笔粗壮的有粗细变化的手写笔触 #ffb765，写出一个流畅干净的字母 S，
像自信的手写体，笔画要足够粗，缩小到 32 像素仍然清晰可辨。
S 的右下方有一枚同样金色的实心小月牙，与笔画明确分开。
S 和月牙整体占画面约 65%，严格居中，四周留白相等。
扁平矢量风格，边缘干净，安静克制，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、其他物体。
```

**通用 / MJ / Flux（英文）**
```
Minimalist avatar icon, square 1:1. Flat solid deep space blue-black background #05070f, no vignette, no gradient, no glow. A single bold calligraphic brushstroke in warm amber gold #ffb765: one continuous tapered stroke forming a clean flowing letter S, drawn like confident hand lettering, thick enough to stay legible when the image is scaled down to 32 pixels. To the lower right of the S, a small solid crescent moon in the same amber gold, clearly separated, same visual weight. The S and the crescent together fill about 65 percent of the frame, positioned exactly in the center with equal margins on all four sides. Flat vector look, crisp clean edges, quiet and calm, high contrast. No gradient, no bloom, no 3D, no photorealism, no texture, no grain, no blur. Absolutely no text, no letters, no words, no typography, no logo, no watermark, no border, no frame, no extra objects.
```

### P2 「一笔 S + 月相（连笔）」 ★ 收笔直接变成月亮

```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
画面中央是一笔连续的、没有断口的手写笔触 #ffb765：
笔画先写出一个流畅的 S，下端收笔时优雅地化成一枚纤细的新月，
整支笔和月亮是一气呵成的一个动作。
字重粗壮，缩小到 32 像素仍然清晰可辨。
标记占画面约 65%，严格居中，四周留白相等。
扁平矢量风格，边缘干净，安静克制，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、其他物体。
```

### P3 「一笔 S + 水波」

```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
画面中央是一笔粗壮的手写笔触 #ffb765 写出的流畅字母 S，
正下方有一条同样金色的短粗水平水波线，两者一起占画面约 65%，
严格居中，四周留白相等。
字重粗壮，缩小到 32 像素仍然清晰可辨。
扁平矢量风格，边缘干净，安静克制，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、其他物体。
```

### P4 「纯一笔 S」 ★ 最保底

```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
画面只有一笔粗壮的手写笔触 #ffb765 写出的一个大号流畅字母 S，别的什么都没有。
字重非常粗壮，缩小到 32 像素依然完美清晰。
标记占画面约 68%，严格居中，四周留白相等。
扁平矢量风格，边缘干净，从容安静，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、其他物体。
```

### P5 「茶盏」（方案 A 的物件版）

```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
一只小陶瓷茶杯带把手放在扁平茶托上，用实心暖金色 #ffb765 表现，杯口升起一缕细的热气。
茶杯占画面约 62%，严格居中，四周留白相等，全部是实心形状，内部不要细节，缩小到 32 像素仍然可辨。
扁平矢量风格，边缘干净，安静克制，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、手、人。
```

### P6 「半月 + 一线」（最保底的抽象版）

```
极简头像图标，正方形 1:1，纯色深空蓝黑背景 #05070f，不要暗角，不要渐变，不要辉光。
一枚实心填充的暖金色 #ffb765 月牙，悬在一条同样金色的粗短水平线正上方，
两者都是实心形状、粗细明确，缩小到 32 像素仍然清晰可辨。
整体占画面约 60%，严格居中，四周留白相等。
扁平矢量风格，边缘干净，安静克制，高对比。
不要渐变，不要辉光溢出，不要立体效果，不要照片质感，不要纹理，不要颗粒，不要模糊。
绝对不要文字、字母、单词、字体、标志、水印、边框、外框、星星、其他物体。
```

---

## 4. 参数

| 工具 | 参数 |
|---|---|
| 即梦 / 豆包 | 比例 1:1，模型选**图片 2.0 / 通用**，风格「插画/扁平」，**每张跑 4 遍**，别指望一次出图 |
| Midjourney | `--ar 1:1 --style raw --stylize 150 --no text, letters, watermark, border` |
| Flux / SD | 1:1，1024×1024，steps 30，CFG 4–6，negative prompt 用上面那段 |

**一次跑 4~8 张，挑形态，别挑细节。**

### 图生图精修（第二轮的做法，效果最好）

拿第一轮最好的那张当输入图（`input_urls`），提示词只描述**要改什么**：

```
Keep the same golden calligraphic letter S and the small crescent moon, but redraw it
bolder and thicker so it stays legible when scaled to 32 pixels. Flat solid deep space
blue-black background #05070f with no vignette, no gradient, no glow. Move the composition
so the S and the crescent sit exactly in the center of the frame, together filling about
68 percent of the width, with equal empty margins on all four sides...
```

这一步把手写笔锋保住了，同时把构图和字重按规范修正——比重新文生图更可控。

---

## 5. 出图后的自检清单（一条不过就重做）

1. **32px 测试**：缩到 32×32 看一眼，认不出 → 淘汰。
2. **48px 测试**：列表里最常见的显示尺寸，再看一眼。
3. **圆形裁切**：套一个直径 300 的圆，主体不能贴边。
   微信/B站/小红书都裁圆，四角等于不存在。
4. **主体占比 60%~70%**：太满显得挤，太小显得缩在列表角落里看不见。
5. **灰度测试**：转成灰度再缩到 32px。还能认出来 → 形状够强。
6. **没有假文字**：放大到 100% 找有没有 AI 自己加的小字/伪 logo，有就擦掉。

---

## 6. 三平台落地

| 平台 | 显示尺寸 | 注意 |
|---|---|---|
| B 站 | 头像 100×100，列表 40px 左右 | 深底在白底列表里是一个深色块，但金色笔画对比够 |
| YouTube | 头像 800×800，列表 40px | 必须上传 800×800（同一张图放大，不是另画一版） |
| 小红书 | 头像圆形裁切 | 主体必须完全在中心圆内 |

- 上传用 **800×800** 那份（油管要求），公众号/小红书/B 站用 **300×300** 那份，**同一张图**。
- 三平台用同一个文件，不要一个剪影一个真人照——那等于开两个号。
- 换头像的代价是让粉丝重新认识你一次，**第一次做对，别换**。

---

## 7. 实跑结果（2026-10-28）

共跑三轮：文生图 5 张 → 文生图 6 张（按 32px 规范重写提示词）→ 图生图精修 2 张。
对比表：`silas-avatar-ai-final-light.png` / `-dark.png`（9 张全量）、
`silas-avatar-ai-picks-light.png`（终选 3 张）。

### 32px 检验的真实结果

| 候选 | 32px 表现 | 结论 |
|---|---|---|
| **图生图 02「S + 月相」** | S 清晰，月牙缩成一个小钩还在 | **定稿** |
| 图生图 01「S + 月相（粗）」 | 同上，略重 | 备选 |
| 第二轮 04「纯一笔 S」 | S 完整，最粗最稳 | 备选（声音更大但少了信息） |
| 第一轮 05「半月 + 线」 | 细到几乎消失 | ✗ 淘汰 |
| 第一轮 04「台灯」 | 糊成一团黑块 | ✗ 淘汰 |
| 第二轮 05「茶盏」 | 杯子很清楚 | 能用，但读作咖啡店 logo |

### 关键经验（下一轮直接照抄）

1. **第一轮失败的根因是提示词没写尺寸约束**。模型默认会把主体画小、把线条画细，
   一到 32px 就没了。必须在提示词里明写 `fill about 65 percent of the frame`、
   `exactly centered`、`thick enough to stay legible when scaled to 32 pixels`。
2. **第二轮加了这三句，6 张全部合格**。这是本轮最值钱的改动。
3. **图生图比文生图更可控**：用第一轮最好的当输入，只描述要改什么，
   手写笔锋保住了，构图和字重还能重排。
4. 台灯、月亮+地平线这类**靠细线/暗部成立的构图，小尺寸必挂**，不要再试。

---

## 8. 定稿

**`silas-avatar-AI-c-s-moon-bold-800.png`** —— 一笔手写 S + 右下一枚小月牙。

理由（按 32px 实际像素放大验证，见 `silas-avatar-32px-zoom.png`）：

1. **唯一一张在 32px 下「S」和「月牙」同时还在的**。别的要么月牙缩成一个点，
   要么整张糊掉。这一条是硬指标，不是审美。
2. 字重够，粗细变化是手写出来的，不是几何图形——缩到 40px 列表里仍有性格。
3. 主色直接取自站点令牌 `#ffb765`，跟 `solozed.com` 同一套色。
4. 底色接近纯色没有辉光，在白底列表里不「飘」。

**两个替代：**

- `silas-avatar-AI-a-s-moon-800.png` —— 更细更优雅的一版，32px 下月牙会缩成一个点。
  如果你更看重「安静」而不是「列表里一眼认出」，选它。
- `silas-avatar-AI-b-s-plain-800.png` —— 纯一笔 S，最粗最稳，但少了「九月」这一层信息。

**已淘汰：** 第一轮 04 台灯（32px 糊成黑块）、第一轮 05 半月+线（细线直接消失）。
靠细线或暗部成立的构图，小尺寸必挂，不要再试。

### 文件清单

```
brand/avatar/
├── avatar-prompts.md                       ← 本文档
├── gen-args.json                           ← 第一轮提示词（5 条）
├── gen-args-round2.json                    ← 第二轮提示词（6 条，加了尺寸约束）
├── gen-args-i2i.json                       ← 图生图精修提示词（2 条）
├── make_ai_sheet.py                        ← 对比表生成器（只做排版，不画形）
├── silas-avatar-AI-a-s-moon-{800,300,64}.png    ★ 定稿
├── silas-avatar-AI-b-s-plain-{800,300,64}.png   ★ 备选
├── silas-avatar-AI-c-s-moon-bold-{800,300,64}.png
├── silas-avatar-ai-picks-light.png / -dark.png ← 终选 3 张自检表
├── silas-avatar-32px-zoom.png                 ← 32px 实际像素放大（定稿依据）
├── silas-avatar-ai-final-light.png / -dark.png ← 全部 9 张候选对比表
├── silas-avatar-ai-r2-light.png / -dark.png    ← 第二轮 6 张
├── silas-avatar-ai-drafts-sheet.png             ← 第一轮 5 张
├── ai-drafts/           ← 全部生图原图（2048×2048）
│   ├── silas-avatar-0*.jpg
│   └── round2/r2-*.jpg|png
└── code-drafts/         ← 早期用代码画的矢量稿（已作废，仅留档参考）
```

> 上传用 `800` 那份（油管要求 800×800），公众号/小红书/B 站用 `300` 那份，**同一张图**。
