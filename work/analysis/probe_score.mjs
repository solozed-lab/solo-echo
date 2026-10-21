// 用 om 自己的 ABC 解析器实测：每个声部的总拍数、每个标记的落点、fit 的弯率。
import { readFileSync } from 'node:fs';
import { parseAbc, perform } from '/Users/yun-z/develop/huashu-motion/cli/lib/composer.js';

const file = process.argv[2] || '/Users/yun-z/Downloads/to/film5/index.html';
const html = readFileSync(file, 'utf8');
const m = /<script\b[^>]*\sid\s*=\s*["']om-score["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (!m) { console.log('NO SCORE in', file); process.exit(1); }
const text = m[1];
const score = parseAbc(text);
console.log('title      ', score.title);
console.log('barLen     ', score.barLen, 'beats/bar   tempo', JSON.stringify(score.tempo));
console.log('voices     ', score.order.map(v => `${v}:${score.voices[v].inst}`).join(' '));
console.log('score len  ', score.length, 'beats =', (score.length / 4), 'bars =', (score.length / 4 * 2).toFixed(2), 's @120');

// 每个声部的总拍数
for (const v of score.order) {
  const evs = score.events.filter(e => e.voice === v);
  const last = evs.length ? Math.max(...evs.map(e => e.beat + e.dur)) : 0;
  console.log(`  voice ${v.padEnd(4)} events ${String(evs.length).padStart(5)}  last beat ${last.toFixed(1)} (${(last/4).toFixed(1)} bars)`);
}

// 标记
console.log('\nmarks in score:');
for (const c of score.cues.filter(c => c.type === 'mark')) console.log(`  ${c.name.padEnd(8)} beat ${c.beat}`);

// 非 mark 的提示（hit / stop / rise …）
const other = score.cues.filter(c => c.type !== 'mark');
if (other.length) {
  console.log('\nother cues:');
  for (const c of other) console.log(`  ${c.type.padEnd(8)} beat ${c.beat} from ${c.from ?? '-'}`);
}

// fit：模拟 film5 的章节标签
const LABELS = { hook: 0, one: 20, two: 90, three: 160, all: 230, join: 270 };
const align = {};
for (const c of score.cues.filter(c => c.type === 'mark')) {
  if (LABELS[c.name] != null) align[c.name] = LABELS[c.name];
}
const perf = perform(score, { start: 0.05, seed: 1, align: Object.keys(align).length ? align : null });
console.log('\nfit marks:');
for (const mk of perf.fit.marks) console.log(`  ${mk.name.padEnd(8)} target ${mk.target}s  at ${mk.at.toFixed(2)}s  (beat ${mk.beat})`);
console.log('stretches:');
for (const s of perf.fit.stretches) console.log(`  ${s.from}→${s.to}  qpm ${s.qpm.toFixed(1)}  bend ${((s.bend) * 100).toFixed(1)}%`);
console.log('end        ', perf.end.toFixed(2), 's   start', perf.start);
