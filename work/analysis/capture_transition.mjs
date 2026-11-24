// 抓一次章节边界的"胶片"：在同一位置附近逐帧截图，用来肉眼看过渡。
// 用法：node work/analysis/capture_transition.mjs <url> <boundaryY> [outDir]
import { launch, newPage } from '/Users/yun-z/develop/huashu-motion/cli/lib/cdp.js';
import { findChrome } from '/Users/yun-z/develop/huashu-motion/cli/lib/browser.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const URL = process.argv[2] || 'http://127.0.0.1:8901/site/';
const BOUND = Number(process.argv[3] || 2400);
const OUT = process.argv[4] || '/tmp/trans';
mkdirSync(OUT, { recursive: true });

const conn = await launch(findChrome(), { args: ['--window-size=1280,720'] });
const page = await newPage(conn);
await page.send('Page.enable'); await page.send('Runtime.enable');
await page.send('Page.navigate', { url: URL });
await new Promise(r => setTimeout(r, 3000));

// 先滚一遍把素材拉下来，再回到边界附近
await page.evaluate(`window.scrollTo(0, ${BOUND})`);
await new Promise(r => setTimeout(r, 6000));

const vh = await page.evaluate('window.innerHeight');
const STEP = Number(process.argv[5] || 0);   // 0 = 自动用 vh 的比例
const offsets = STEP ? [-3,-2,-1,0,1,2,3].map(k => k * STEP)
                      : [-0.55, -0.35, -0.18, -0.06, 0, 0.06, 0.18, 0.35, 0.55].map(k => Math.round(k * vh));
for (let i = 0; i < offsets.length; i++) {
  const y = BOUND + offsets[i];
  await page.evaluate(`window.scrollTo(0, ${y})`);
  await new Promise(r => setTimeout(r, 260));
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const name = `${OUT}/t${String(i).padStart(2, '0')}_y${y}.png`;
  writeFileSync(name, Buffer.from(shot.data, 'base64'));
  console.log(name);
}
await conn.close({ fast: true });
process.exit(0);
