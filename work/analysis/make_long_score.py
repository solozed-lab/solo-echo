#!/usr/bin/env python3
"""生成 5 分钟版 ABC 乐谱并注入 film5/index.html。

实测规则（用 om 自带解析器 work/analysis/probe_score.mjs 校准，别靠猜）：
  · L:1/8 时 1 个音符 = 0.25 拍 = 0.125s；M:2/4 时 1 小节 = 2 拍 = 1.00s
  · 1 个 cell = 8 个音符 = 1 小节 = 1.00s（全片最小时间单位）
  · `|:` 乐句播两遍 → 1 块 = 2 × 5 cell = 10s
  · 休止：z = 1 音符(0.25 拍)，Z = 1 小节(2 拍 = 1s)
  · **各声部的每段长度必须完全一致**：解析器不做补齐，某声部短了会整体前移
    （上一版 DH/VLN 只有部分段落 → 镲片和弦乐全跑到片头了）
  · `!mark:name!` 落在时间轴标签 `name` 或 `scene:name` 上，每段只写一次，写在旋律声部
"""
import pathlib, re, sys

# ---- 时间网格 ----
SEC_PER_CELL = 1.0                 # 1 cell = 1s
CELLS_PER_PHRASE = 5               # 一句 = 5 cell = 5s
SEC_PER_BLOCK = 2 * CELLS_PER_PHRASE   # `|: 乐句 :|` = 10s

# 章节：名字 / 时长(s) / 块数(每块 10s)
SECTIONS = [
    ('hook',  30, 3),
    ('one',   80, 8),
    ('two',   80, 8),
    ('three', 80, 8),
    ('all',   40, 4),
    ('join',  30, 3),
]
DYN = {'hook': '!pp!', 'one': '!mp!', 'two': '!mf!', 'three': '!mp!', 'all': '!ff!', 'join': '!mf!'}

def _scan(tok):
    """把一段 ABC 拆成音符/和弦/休止（解析器就是这么切的；和弦里可以有空格）。"""
    out, i, n = [], 0, len(tok)
    while i < n:
        c = tok[i]
        if c.isspace():
            i += 1
            continue
        if c == '[':
            j = tok.index(']', i)
            out.append(('chord', tok[i + 1:j]))
            i = j + 1
            continue
        if c in 'zZ':
            j = i + 1
            while j < n and tok[j].isdigit():
                j += 1
            out.append(('rest', tok[i:j]))
            i = j
            continue
        if c in 'ABCDEFGabcdefg':
            j = i + 1
            while j < n and tok[j] in ",'^_=":
                j += 1
            while j < n and tok[j].isdigit():
                j += 1
            if j < n and tok[j] == '/':             # 斜杠写法：长度被解析成 0.5
                out.append(('slash', tok[i:j]))
                i = j + 1
                continue
            out.append(('note', tok[i:j]))
            i = j
            continue
        i += 1
    return out

def _len_of(text):
    m = re.search(r'[0-9]+$', text)
    return float(m.group()) if m else 1.0

# 实测换算（M:2/4, L:1/8, 120BPM → 1 拍 = 0.5s）：
#   · 普通音符 'E' / 'E,,2' → 长度 k = k × 0.5 拍
#   · 斜杠写法 'E/B/e/B/'  → 结尾的 '/' 被解析成"长度 0.5"，每个音只有 0.25 拍
#   · 和弦 '[E E]' → 0.5 拍（取第一个音的长度）
#   · 休止 'z' = 0.5 拍，'Z' = 1 小节 = 2 拍（M:2/4）
NOTE_UNIT = 0.5
SLASH_UNIT = 0.25

def _tok_beats(tok):
    """一个记号（音符/和弦/休止）的拍数。"""
    total = 0.0
    for kind, text in [tok]:
        if kind == 'chord':
            first = _scan(text)                      # 和弦取第一个音的长度
            total += (_len_of(first[0][1]) if first else 1.0) * NOTE_UNIT
        elif kind == 'rest':
            total += _len_of(text[1:]) * (2.0 if text[0] == 'Z' else NOTE_UNIT)
        elif kind == 'slash':                        # 'E/B/e/B/' 里的每个音
            total += SLASH_UNIT
        else:
            total += _len_of(text) * NOTE_UNIT
    return total

def beats_of(cell):
    return sum(_tok_beats(t) for t in _scan(cell))

def cell_seconds(cell):
    return beats_of(cell) * 0.5     # 120BPM → 1 拍 = 0.5s

def check_cell(cell, where):
    s = cell_seconds(cell)
    if abs(s - SEC_PER_CELL) > 1e-6:
        raise SystemExit('cell 长度不是 1s: %s → %.3fs  (%s)' % (where, s, cell))
    return cell

# ==========================================================
# 乐句素材：每个 cell 恰好 1s，每个乐句 5 个 cell
# ==========================================================
def rep(cell, n):
    return [check_cell(cell, 'rep')] * n

PLK = {
  # 动机 = 回声 E–B–e–B（16 分音符写法）；hook 最稀，one 有伙伴感，two 机械，three 上行，all 升八度
  'hook': (
    ['E/B/e/B/ G/B/e/B/', 'E/B/e/B/ G/B/e/B/', 'e/B/e/B/ G/B/e/B/', 'E/B/e/B/ G/B/e/B/', 'E/B/e/B/ G/B/e/B/'],
    ['E/B/e/B/ G/B/e/B/', 'e/B/e/B/ G/B/e/B/', 'e/B/e/B/ B/B/B/B/', 'E/B/e/B/ G/B/e/B/', 'B,/G/d/G/ B,/G/d/G/']),
  'one': (
    ['E/B/e/B/ G/B/e/B/', 'C/G/e/G/ E/G/e/G/', 'E/B/e/B/ G/B/e/B/', 'C/G/e/G/ E/G/e/G/', 'E/B/e/B/ G/B/e/B/'],
    ['E/B/e/B/ G/B/e/B/', 'C/G/e/G/ E/G/e/G/', 'B,/G/d/G/ B,/G/d/G/', 'E/B/e/B/ G/B/e/B/', 'C/G/e/G/ E/G/e/G/']),
  'two': (
    ['E/B/e/B/ E/B/e/B/', 'G/B/e/B/ G/B/e/B/', 'D/G/d/G/ D/G/d/G/', 'B,/G/d/G/ B,/G/d/G/', 'E/B/e/B/ G/B/e/B/'],
    ['E/B/e/B/ E/B/e/B/', 'G/B/e/B/ G/B/e/B/', 'D/G/d/G/ D/G/d/G/', 'B,/G/d/G/ B,/G/d/G/', 'B,/G/d/G/ G/B/e/B/']),
  'three': (
    ['G/B/e/B/ A/C/e/C/', 'B,/D/f/D/ C/E/g/E/', 'G/B/e/B/ A/C/e/C/', 'B,/D/f/D/ C/E/g/E/', 'D/F/a/F/ E/G/b/G/'],
    ['G/B/e/B/ A/C/e/C/', 'B,/D/f/D/ C/E/g/E/', 'D/F/a/F/ E/G/b/G/', 'F/A/c/A/ G/B/d/B/', 'G/B/e/B/ A/C/e/C/']),
  'all': (
    ["E'/B'/e'/B'/ G'/B'/e'/B'/", "E'/B'/e'/B'/ G'/B'/e'/B'/", "C'/G'/e'/G'/ E'/G'/e'/G'/", "D'/G'/d'/G'/ B,'/G'/d'/G'/", "E'/B'/e'/B'/ G'/B'/e'/B'/"],
    ["E'/B'/e'/B'/ G'/B'/e'/B'/", "C'/G'/e'/G'/ E'/G'/e'/G'/", "D'/G'/d'/G'/ B,'/G'/d'/G'/", "E'/B'/e'/B'/ G'/B'/e'/B'/", "E'/B'/e'/B'/ G'/B'/e'/B'/"]),
  # 收束：换成八分音符写法，动机拉宽
  'join': (
    ['E B e B', 'G B e B', 'E B e B', 'G B e B', 'E4'],
    ['E B e B', 'G B e B', 'E B e B', 'B, B, C C', 'E4']),
}

BAS = {
  'hook':  (rep('E,,4', 5), rep('E,,4', 5)),
  'one':   (rep('E,,2 E,,2', 3) + rep('C,,2 C,,2', 2),
            rep('C,,2 C,,2', 2) + rep('E,,2 E,,2', 3)),
  'two':   (rep('E,,2 E,,2', 3) + rep('D,,2 D,,2', 2),
            rep('D,,2 D,,2', 2) + rep('E,,2 E,,2', 3)),
  'three': (rep('E,,4', 5), rep('E,,4', 3) + rep('C,,4', 2)),
  'all':   (rep('E,,2 E,,2', 2) + rep('C,,2 C,,2', 2) + rep('D,,2 D,,2', 1),
            rep('E,,2 E,,2', 2) + rep('D,,2 D,,2', 2) + rep('C,,2 C,,2', 1)),
  'join':  (rep('E,,4', 5), rep('E,,4', 3) + rep('C,,4', 2)),
}

DK = {
  'one':   (rep('C,,2 z2', 5), rep('C,,2 z2', 5)),
  'two':   (rep('C,,2 C,,2', 5), rep('C,,2 C,,2', 5)),
  'three': (rep('C,,2 z2', 5), rep('C,,2 z2', 5)),
  'all':   (rep('C,,2 C,,2', 5), rep('C,,2 C,,2', 5)),
  'join':  (rep('C,,2 z2', 5), rep('C,,2 z2', 5)),
}

DH = {  # hi-hat 只在机械段和爆点段
  'two': (rep('^F,,^F,, [D,,^F,,]^F,,', 5), rep('^F,,^F,, [D,,^F,,]^F,,', 5)),
  'all': (rep('^F,,^F,, [D,,^F,,]^F,,', 5), rep('^F,,^F,, [D,,^F,,]^F,,', 5)),
}

VLN = {  # 弦乐只出现在"人与人"（全片唯一有人味的一段）和爆点
  'three': (['G, G, A, A,', 'B, B, C C', 'D D E E', 'F F G G', 'A A B, B,'],
            ['G, G, A, A,', 'B, B, C C', 'D D E E', 'F F G G', 'G, A, B, C']),
  'all':   (["[E' E'] [G' G'] [E' E'] [G' G']",
             "[E' E'] [D' D'] [E' E'] [D' D']",
             "[C' E'] [E' G'] [C' E'] [E' G']",
             "[B' D'] [G' B'] [B' D'] [G' B']",
             "[E' E'] [G' G'] [E' E'] [G' G']"],
            ["[E' E'] [G' G'] [E' E'] [G' G']",
             "[C' E'] [E' G'] [C' E'] [E' G']",
             "[B' D'] [G' B'] [B' D'] [G' B']",
             "[E' E'] [G' G'] [E' E'] [G' G']",
             "[E' E'] [G' G'] [E' E'] [G' G']"]),
}
for name, d in (('BAS', BAS), ('DK', DK), ('DH', DH), ('VLN', VLN)):
    for k, (a, b) in d.items():
        for ph in (a, b):
            for c in ph:
                check_cell(c, '%s/%s' % (name, k))

# ==========================================================
# 组装：每声部每段的总长度必须相同
#
# ⚠️ 每个声部必须压成**一行**：解析器的重复逻辑用声部级 `lastRepeat` 去比对
#    **行内**的 token 下标，同一行里第二个 `|: :|` 的下标与第一个相同 → 不再重复，
#    于是"每块 10s"变成"第一块 10s、其余每块 5s"（实测：3 块 = 20+10+10 拍）。
#    压成一行后每块的 token 下标各不相同，重复才正常。
# ==========================================================
# 「万物涌现」之前的一次磁带停转：人声部在 people&people 段末尾减速停住，爆发点才有落差。
# 停转放在一个本来就静默的声部（DH 的 rest 段）上，时长 = 该段末尾 5s。
STOP = {'voice': 'DH', 'section': 'three', 'cells': 5}

def voice_line(voice_map, inst_line, with_marks=False, stop_here=False):
    parts = []
    for key, dur, nblocks in SECTIONS:
        cells = int(round(dur / SEC_PER_CELL))
        deco = ''
        if with_marks:
            deco = '!mark:%s! %s' % (key, DYN[key])
            if key == 'all':
                deco += ' !hit!'        # 涌现瞬间：impact + subdrop
        if key in voice_map:
            A, B = voice_map[key]
            blocks = []
            for b in range(nblocks):
                phrase = A if b % 2 == 0 else B
                blocks.append('|:%s :|' % ' | '.join(phrase))
            parts.append((deco + ' ' if deco else '') + ' '.join(blocks))
        else:
            # 静默段：Z = 1 小节 = 1s，个数必须刚好等于该段长度
            rests = ['Z'] * cells
            if stop_here and key == STOP['section']:
                k = STOP['cells']
                rests = (['Z'] * (cells - k)) + ['!stop(!'] + ['Z'] * k + ['!stop)!']
            parts.append((deco + ' ' if deco else '') + ' '.join(rests))
    return inst_line, ' '.join(parts)

# 声部定义必须单独一行（定义行会把同行的乐谱吃掉），乐谱整体压成一行
score = ['X:1',
         'T:Solo & Echo · 犹如三生万物（长版：动机=回声 E–B–e–B，120BPM，300s）',
         'M:2/4', 'L:1/8', 'Q:1/4=120', 'K:Em']
for _map, _inst, _marks in ((PLK, 'V:PLK inst=synpluck gain=0.55', True),
                            (BAS, 'V:BAS inst=synbass gain=0.8', False),
                            (DK,  'V:DK inst=drums kit=808 gain=0.9', False),
                            (DH,  'V:DH inst=drums kit=pop gain=0.5', False),
                            (VLN, 'V:VLN inst=violins role=melody gain=0.7', False)):
    _def, _body = voice_line(_map, _inst, _marks, _inst.startswith('V:' + STOP['voice']))
    score.append(_def)
    score.append(_body)

abc = '<script type="text/vnd.abc" id="om-score">\n' + '\n'.join(score) + '\n</script>'

p = pathlib.Path('/Users/yun-z/Downloads/to/film5/index.html')
s = p.read_text()
if 'id="om-score"' in s:
    s = re.sub(r'<script type="text/vnd\.abc" id="om-score">.*?</script>', lambda m: abc, s, flags=re.S)
else:
    s = s.replace('<script>\n(() => {', abc + '\n<script>\n(() => {')
p.write_text(s)
print('score injected,', len(score), 'lines')
