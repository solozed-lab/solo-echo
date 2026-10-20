#!/usr/bin/env python3
"""生成 5 分钟版的 ABC 乐谱并注入 film5/index.html。

这个 ABC 解析器的实测规则（踩过的坑）：
  · L:1/8 时，1 组 8 个音符 = 1.00s（Q:1/4=120）
  · `|:` ... `:|` 把整段播两遍；串接 k 个块 = 2k 遍
  · 超过一小节（16 单位）的小组会溢成两小节 → 配速被拉快一倍
  · z4 / z8 是无效休止，会让整条声部被丢弃 → 只能用 z / z2
  · fit 按"标记之间的组数"算配速：段落 N 秒需要 N 组音符
"""
import pathlib, re

G = 5  # 每小节 5 组

def blocks(cell, n):
    """把一个 5 组乐句用 `|:` 反复块写 n 次（每块播两遍 = 10 组）。"""
    return ''.join('|:' + cell + ':| ' for _ in range(n))

def groups(pattern, n):
    return ''.join(pattern for _ in range(n))

# ---- 旋律（PLK）：每段两个乐句 A / B，块序 A B A ----
PLK = {
  'hook':  ('E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/',
            'E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/ | E/B/e/B/ G/B/e/B/'),
  # 一 · 人与 AI：动机 + 错位应答（伙伴感）
  'one':   ('E/B/e/B/ G/B/e/B/ | C/G/e/G/ E/G/e/G/ | E/B/e/B/ G/B/e/B/ | C/G/e/G/ E/G/e/G/ | E/B/e/B/ G/B/e/B/',
            'E/B/e/B/ G/B/e/B/ | C/G/e/G/ E/G/e/G/ | B,/G/d/G/ B,/G/d/G/ | E/B/e/B/ G/B/e/B/ | C/G/e/G/ E/G/e/G/'),
  # 二 · AI 与 AI：机械 ostinato
  'two':   ('E/B/e/B/ E/B/e/B/ | G/B/e/B/ G/B/e/B/ | D/G/d/G/ D/G/d/G/ | B,/G/d/G/ B,/G/d/G/ | E/B/e/B/ G/B/e/B/',
            'E/B/e/B/ E/B/e/B/ | G/B/e/B/ G/B/e/B/ | D/G/d/G/ D/G/d/G/ | B,/G/d/G/ B,/G/d/G/ | E/B/e/B/ G/B/e/B/'),
  # 三 · 人与人：暖的、往上走的旋律
  'three': ('G/B/e/B/ A/C/e/C/ | B,/D/f/D/ C/E/g/E/ | G/B/e/B/ A/C/e/C/ | B,/D/f/D/ C/E/g/E/ | D/F/a/F/ E/G/b/G/',
            'G/B/e/B/ A/C/e/C/ | B,/D/f/D/ C/E/g/E/ | D/F/a/F/ E/G/b/G/ | F/A/c/A/ G/B/d/B/ | G/B/e/B/ A/C/e/C/'),
  # 万物：动机升八度，全编制
  'all':   ("E'/B'/e'/B'/ G'/B'/e'/B'/ | E'/B'/e'/B'/ G'/B'/e'/B'/ | C'/G'/e'/G'/ E'/G'/e'/G'/ | D'/G'/d'/G'/ B,'/G'/d'/G'/ | E'/B'/e'/B'/ G'/B'/e'/B'/",
            "E'/B'/e'/B'/ G'/B'/e'/B'/ | C'/G'/e'/G'/ E'/G'/e'/G'/ | D'/G'/d'/G'/ B,'/G'/d'/G'/ | E'/B'/e'/B'/ G'/B'/e'/B'/ | E'/B'/e'/B'/ G'/B'/e'/B'/"),
  # 加入：动机收束
  'join':  ('E2 B2 e2 B2 | G2 B2 e2 B2 | E2 B2 e2 B2 | G2 B2 e2 B2 | E8',
            'E2 B2 e2 B2 | G2 B2 e2 B2 | E2 B2 e2 B2 | G2 B2 e2 B2 | E8'),
}

# ---- 低音（BAS）：每段两个乐句 ----
BAS = {
  'hook':  ('E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2',
            'E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2'),
  'one':   ('E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | E,,2 E,,2 E,,2 E,,2',
            'E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | E,,2 E,,2 E,,2 E,,2'),
  'two':   ('E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | D,,2 D,,2 D,,2 D,,2 | D,,2 D,,2 D,,2 D,,2 | E,,2 E,,2 E,,2 E,,2',
            'E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | B,,2 B,,2 B,,2 B,,2 | B,,2 B,,2 B,,2 B,,2 | E,,2 E,,2 E,,2 E,,2'),
  'three': ('E,,8 | E,,8 | E,,8 | E,,8 | E,,8',
            'E,,8 | E,,8 | C,,8 | C,,8 | E,,8'),
  'all':   ('E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | E,,2 E,,2 E,,2 E,,2',
            'E,,2 E,,2 E,,2 E,,2 | E,,2 E,,2 E,,2 E,,2 | D,,2 D,,2 D,,2 D,,2 | D,,2 D,,2 D,,2 D,,2 | E,,2 E,,2 E,,2 E,,2'),
  'join':  ('E,,8 | E,,8 | E,,8 | E,,8 | E,,8',
            'E,,8 | E,,8 | E,,8 | E,,8 | E,,8'),
}

# ---- 底鼓（808） ----
DK = {
  'hook':  ('C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2',
            'C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2'),
  'one':   ('C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2',
            'C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2 | C,,2 z2 C,,2 z2 C,,2 z2 C,,2'),
  'two':   ('C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2',
            'C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | D,,2 D,,2 D,,2 D,,2 | D,,2 D,,2 D,,2 D,,2 | C,,2 C,,2 C,,2 C,,2'),
  'three': ('C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2',
            'C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2 | C,,2 z2 z2 z2 C,,2 z2 z2 z2'),
  'all':   ('C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2',
            'C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2 | C,,2 C,,2 C,,2 C,,2'),
  'join':  ('C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | z2 z2 z2 z2 z2 z2 z2 z2',
            'C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | C,,2 z2 z2 z2 z2 z2 z2 z2 | z2 z2 z2 z2 z2 z2 z2 z2'),
}

# ---- hi-hat（pop）：只在机械段与爆点段 ----
DH = {
  'two':   ('^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,,',
            '^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, [D,,^F,,]^F,,'),
  'all':   ('^F,,^F,, [D,,^F,,]^F,, ^F,,^F,, | [D,,^F,,]^F,, ^F,,^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, ^F,,^F,, | [D,,^F,,]^F,, ^F,,^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, ^F,,^F,,',
            '^F,,^F,, [D,,^F,,]^F,, ^F,,^F,, | [D,,^F,,]^F,, ^F,,^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, ^F,,^F,, | [D,,^F,,]^F,, ^F,,^F,, [D,,^F,,]^F,, | ^F,,^F,, [D,,^F,,]^F,, ^F,,^F,,'),
}

# ---- 弦乐：只出现在"人与人"（唯一有人味的一段）与爆点 ----
VLN = {
  'three': ('G,2 G,2 A,2 A,2 | B,2 B,2 C2 C2 | D2 D2 E2 E2 | F2 F2 G2 G2 | A2 A2 B,2 B,2',
            'G,2 G,2 A,2 A,2 | B,2 B,2 C2 C2 | D2 D2 E2 E2 | F2 F2 G2 G2 | A2 A2 B,2 B,2'),
  'all':   ("[E'2 E'2] [G'2 G'2] | [E'2 E'2] [D'2 D'2] | [C'2 C'2] [E'2 E'2] | [B'2 B'2] [G'2 G'2] | [E'2 E'2] [G'2 G'2]",
            "[E'2 E'2] [G'2 G'2] | [E'2 E'2] [D'2 D'2] | [C'2 C'2] [E'2 E'2] | [B'2 B'2] [G'2 G'2] | [E'2 E'2] [G'2 G'2]"),
}

# 段落 → 标记名 / 需要的组数 / 块数
# 每块 `|: cell :|` = 5 组乐句播两遍 = 10 组 = 10 秒
SECTIONS = [
  ('hook',  'hook',  20, 2),
  ('one',   'one',   60, 6),
  ('two',   'two',   60, 6),
  ('three', 'three', 60, 6),
  ('all',   'all',   60, 6),
  ('join',  'join',  40, 4),
]
DYN = {'hook': '!pp!', 'one': '!mp!', 'two': '!mf!', 'three': '!mp!', 'all': '!ff!', 'join': '!mf!'}

def voice_lines(voice_map, sections, inst_line, with_marks=True):
    out = [inst_line]
    for key, mark, need_groups, nblocks in sections:
        if key not in voice_map:
            continue
        A, B = voice_map[key]
        # A B 交替，块数决定段落长度
        seq = [A if k % 2 == 0 else B for k in range(nblocks)]
        cells = ''.join(blocks(c, 1) for c in seq)
        head = ('!mark:%s! ' % mark) if with_marks else ''
        out.append('%s%s %s' % (head, DYN[key], cells))
    return '\n'.join(out)

score = ['X:1',
         'T:Solo & Echo · 犹如三生万物（长版：动机=回声 E–B–e–B，120BPM，300s）',
         'M:4/4', 'L:1/8', 'Q:1/4=120', 'K:Em',
         voice_lines(PLK, SECTIONS, 'V:PLK inst=synpluck gain=0.55'),
         voice_lines(BAS, SECTIONS, 'V:BAS inst=synbass gain=0.8', False),
         voice_lines(DK,  SECTIONS, 'V:DK inst=drums kit=808 gain=0.9', False),
         voice_lines(DH,  SECTIONS, 'V:DH inst=drums kit=pop gain=0.5', False),
         voice_lines(VLN, SECTIONS, 'V:VLN inst=violins role=melody gain=0.7', False)]

abc = '<script type="text/vnd.abc" id="om-score">\n' + '\n'.join(score) + '\n</script>'

p = pathlib.Path('/Users/yun-z/Downloads/to/film5/index.html')
s = p.read_text()
if 'id="om-score"' in s:
    s = re.sub(r'<script type="text/vnd\.abc" id="om-score">.*?</script>', lambda m: abc, s, flags=re.S)
else:
    s = s.replace('<script>\n(() => {', abc + '\n<script>\n(() => {')
p.write_text(s)
print('score injected,', len(score), 'lines')
