// 滚动流畅度测量：模拟一次快速滚动，统计帧率、最长卡顿、seek 次数。
// 用法：node work/analysis/measure_scroll.mjs <url>
import { launch, newPage } from '/Users/yun-z/develop/huashu-motion/cli/lib/cdp.js';
import { findChrome } from '/Users/yun-z/develop/huashu-motion/cli/lib/browser.js';

const URL = process.argv[2] || 'http://127.0.0.1:8901/site/';
const DUR = 3.0;          // 滚动时长（秒）
const DIST = 2.0;         // 滚过几屏

const MOBILE = process.argv[3] === 'mobile';
const conn = await launch(findChrome(), { args: [MOBILE ? '--window-size=390,844' : '--window-size=1280,720'] });
const page = await newPage(conn);
await page.send('Page.enable');
await page.send('Runtime.enable');

if (MOBILE) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
}
await page.send('Page.navigate', { url: URL });
await new Promise(r => setTimeout(r, 2500));   // 等首屏与素材就位

const out = await page.evaluate(`(async () => {
  // 统计所有 currentTime 赋值（= seek 次数）
  const proto = HTMLMediaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'currentTime');
  let seeks = 0;
  Object.defineProperty(proto, 'currentTime', {
    get: desc.get,
    set(v) { seeks++; return desc.set.call(this, v); },
    configurable: true
  });

  let frames = 0, last = performance.now(), worst = 0, worstAt = 0;
  const tick = () => {
    const now = performance.now();
    const gap = now - last; last = now;
    if (gap > worst) { worst = gap; worstAt = now; }
    frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const t0 = performance.now();
  const start = window.scrollY;
  await new Promise(res => {
    const step = () => {
      const p = (performance.now() - t0) / ${DUR * 1000};
      window.scrollTo(0, start + p * window.innerHeight * ${DIST});
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const dur = (performance.now() - t0) / 1000;
  Object.defineProperty(proto, 'currentTime', desc);
  return {
    fps: +(frames / dur).toFixed(1),
    frames, dur: +dur.toFixed(2),
    worstGapMs: +worst.toFixed(1),
    seeks, seeksPerSec: +(seeks / dur).toFixed(1),
    videos: document.querySelectorAll('video').length,
    scrollY: Math.round(window.scrollY)
  };
})()`);

console.log(JSON.stringify(out, null, 2));
await page.close();
await conn.close({ fast: true });
process.exit(0);
