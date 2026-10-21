/* ============================================================================
   sfx.js — 站点音效层（Web Audio 合成，零音频文件）
   ----------------------------------------------------------------------------
   音效用与宣传片同一套词汇：whoosh / hit / pop / tick / impact / subdrop /
   chime / glitch / swell。

   浏览器自动播放策略：AudioContext 必须在用户手势后才能启动，
   所以这里懒创建 —— 第一次 pointerdown / wheel / keydown 时才建。

   开关状态存 localStorage；默认开（但要等用户碰过页面才有声音）。
   ========================================================================== */
(function () {
  'use strict';

  const KEY = 'soloecho.sfx';
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;
  let unlocked = false;

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'off' || saved === 'on') enabled = saved === 'on';
  } catch (e) { /* 隐私模式 */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // 一段 2 秒的白噪声，所有"气流/冲击"类音效都由它塑形
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function now() { return ctx.currentTime; }

  function noise(dur, gain, f0, f1, q, type) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type || 'bandpass';
    flt.Q.value = q == null ? 1.2 : q;
    flt.frequency.setValueAtTime(f0, now());
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, f1), now() + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now());
    g.gain.linearRampToValueAtTime(gain, now() + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(); src.stop(now() + dur + 0.05);
  }

  function tone(type, f0, f1, dur, gain, delay) {
    const t0 = now() + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  /* ==================================================================
     音效分两层
     ------------------------------------------------------------------
     1) 界面事件（点击 / 悬停 / 开关 / 弹出 / 涟漪）
        → 用 CC0 音效库 "Crisp UI"（sfxmint.com，CC0 1.0，免署名）。
          这套的定位是"干、脆、亮"，正是科技感该有的质地；
          全部是 45–510ms 的短音，没有一个拖长尾巴。
          共 7 个文件 27KB，懒加载：第一次用户手势之后才拉。
     2) 切屏（章节切换）
        → CC0 的 swipe（逐章变调，一路往上走）+ 一记本场合成的
          FM 落点音（E 小调，和弦逐章变满）。
          片子里的动机和站点是同一件乐器。
     ------------------------------------------------------------------ */
  const SAMPLE_FILES = {
    click: 'assets/sfx/click.mp3',
    hover: 'assets/sfx/hover.mp3',
    toggle: 'assets/sfx/toggle.mp3',
    swipe: 'assets/sfx/swipe.mp3',
    pop: 'assets/sfx/pop.mp3',
    modal: 'assets/sfx/modal.mp3',
    confirm: 'assets/sfx/confirm.mp3'
  };
  const samples = {};        // name -> AudioBuffer
  const sampleBytes = {};    // name -> ArrayBuffer（页面加载时就拉下来）
  let samplesLoading = false;

  /* 提前把 mp3 拉下来 —— 这一步不需要 AudioContext，可以页面一加载就做。
     等用户第一次手势、AudioContext 存在了再解码，
     这样第一次点击就有声音；同时又不会在没有手势时创建 AudioContext
     （浏览器会打一条"The AudioContext was not allowed to start"的警告）。 */
  function prefetchSamples() {
    if (samplesLoading) return;
    samplesLoading = true;
    Object.keys(SAMPLE_FILES).forEach(name => {
      fetch(SAMPLE_FILES[name])
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('sfx ' + r.status))))
        .then(ab => { sampleBytes[name] = ab; })
        .catch(() => { /* 音频拉不到也不该弄坏页面：这一路静默降级 */ });
    });
  }

  function loadSamples() {
    const c = ensure();
    if (!c) return;
    Object.keys(sampleBytes).forEach(name => {
      if (samples[name]) return;
      // decodeAudioData 会"消耗"掉 ArrayBuffer，所以传一份拷贝
      c.decodeAudioData(sampleBytes[name].slice(0))
        .then(buf => { samples[name] = buf; })
        .catch(() => {});
    });
  }

  /* 播一个采样。
     rate = 变调（切屏音逐章递进就靠它），gain 是相对主增益的音量。 */
  function sample(name, opts) {
    if (!enabled) return;
    const buf = samples[name];
    const c = ensure();
    if (!buf || !c || c.state !== 'running') return;
    const o = opts || {};
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    const g = c.createGain();
    g.gain.value = o.gain == null ? 0.55 : o.gain;
    src.connect(g);
    g.connect(master);
    src.start(now() + (o.delay || 0));
  }

  /* 切屏音：每章一记，逐章递进
     ------------------------------------------------------------------
     「切」= CC0 的 swipe，逐章变调（0.88 → 1.24，一路往上走）
     「落」= 本场合成的 FM 音，E 小调，和弦逐章变满：
       起点   E4              一记孤独的单音
       人与 AI E4+B4          加一个五度 —— 对面有东西了
       AI 与 AI E4+B4+E5      八度叠五度 —— 紧、准、机器对撞
       人与人 E4+G4+B4       E 小三和弦 —— 全片唯一有体温的一段
       万物   E5+G5+B5       升八度 —— 三种关系同时成立
       加入   E4+B4+E5+B5    四音齐备 —— 万物齐了
     ------------------------------------------------------------------ */
  const CHAPTER_SOUND = [
    { f: [329.63], ratio: 1.00, index: 0.8, sub: 0, rate: 0.88, gain: 0.055 },
    { f: [329.63, 493.88], ratio: 1.41, index: 1.6, sub: 82, rate: 0.95, gain: 0.055 },
    { f: [329.63, 493.88, 659.26], ratio: 2.00, index: 2.4, sub: 98, rate: 1.02, gain: 0.052 },
    { f: [329.63, 392.00, 493.88], ratio: 1.41, index: 1.2, sub: 73, rate: 1.08, gain: 0.055 },
    { f: [659.26, 783.99, 987.77], ratio: 3.00, index: 1.8, sub: 98, rate: 1.16, gain: 0.048 },
    { f: [329.63, 493.88, 659.26, 987.77], ratio: 2.00, index: 1.4, sub: 65, rate: 1.24, gain: 0.055 }
  ];

  /* FM 落点音：载波 + 调制器，调制指数快速衰减 = 金属/电子质感。
     比纯正弦叠加"科技"得多，也不像真钟声那样暖。 */
  function fmPing(freq, t0, dur, gain, ratio, index) {
    const c = ensure();
    if (!c) return;
    const car = c.createOscillator();
    car.type = 'sine';
    car.frequency.value = freq;
    const mod = c.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * ratio;
    const mg = c.createGain();
    mg.gain.setValueAtTime(freq * index, t0);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * index * 0.015), t0 + dur * 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.connect(g);
    g.connect(master);
    mod.start(t0); mod.stop(t0 + dur + 0.02);
    car.start(t0); car.stop(t0 + dur + 0.05);
  }

  const diag = { chapter: -1, voices: [], count: 0, samples: [] };

  function playChapter(i) {
    const c = CHAPTER_SOUND[i];
    if (!c) return;
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx || ctx.state !== 'running') return;

    const t0 = now() + 0.005;
    // 「切」：干、脆、亮的 swipe，逐章变调 → 一路往上走
    sample('swipe', { rate: c.rate, gain: 0.45 });
    // 「落」：E 小调 FM 音，和弦逐章变满
    c.f.forEach((f, k) => fmPing(f, t0 + k * 0.007, 0.30, c.gain, c.ratio, c.index));
    // 低频落点
    if (c.sub) tone('sine', c.sub * 1.7, c.sub * 0.5, 0.20, 0.14, t0);

    diag.chapter = i;
    diag.voices = c.f.slice();
    diag.count++;
  }

  const VOICES = {
    // 章节切换：气流扫过 + 一点落点
    whoosh() { noise(0.42, 0.16, 320, 2600, 0.9); noise(0.30, 0.07, 2200, 420, 1.4); },
    // 落点：一记闷响
    hit() { tone('sine', 150, 52, 0.20, 0.30); noise(0.09, 0.12, 1400, 300, 0.7); },
    // 文字露出：极轻的一点
    pop() { tone('triangle', 720, 520, 0.09, 0.10); },
    tick() { tone('square', 1900, 1600, 0.035, 0.045); },
    // 弹框打开：低频落点 + 空气
    impact() { tone('sine', 190, 44, 0.55, 0.42); tone('sine', 95, 38, 0.7, 0.22, 0.02); noise(0.5, 0.09, 900, 120, 0.8); },
    // 弹框关闭：一记收尾
    close() { tone('sine', 300, 120, 0.16, 0.16); noise(0.14, 0.05, 1800, 500, 1.2); },
    // 扩散脉冲：808 式下坠
    subdrop() { tone('sine', 120, 30, 0.8, 0.40); tone('sine', 240, 60, 0.5, 0.10); noise(0.6, 0.10, 2600, 200, 0.7); },
    // CTA：两声铃
    chime() { tone('sine', 1180, 1180, 0.5, 0.16); tone('sine', 1770, 1770, 0.42, 0.09, 0.06); },
    // 切换语言：数字错位
    glitch() { for (let i = 0; i < 5; i++) tone('square', 380 + i * 190, 300 + i * 120, 0.035, 0.07, i * 0.026); noise(0.16, 0.09, 3200, 900, 2.2); },
    // 能量涌起
    swell() { noise(0.75, 0.13, 260, 3400, 0.8); }
  };

  function unlock() {
    if (unlocked) return;
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
    // 采样要等 AudioContext 存在才能 decode，所以放在解锁之后
    loadSamples();
  }

  function play(name, opts) {
    if (!enabled) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const fn = VOICES[name];
    if (!fn) return;
    try { fn(opts || {}); } catch (e) { /* 声音永远不该弄坏页面 */ }
  }

  window.SWSfx = {
    play,
    playChapter,
    sample,
    unlock,
    get enabled() { return enabled; },
    get unlocked() { return unlocked; },
    /* 只读诊断：验收脚本用来确认"每章确实是不同的动机" */
    get diag() { return { chapter: diag.chapter, voices: diag.voices.slice(), count: diag.count, loaded: Object.keys(samples).length }; },
    setEnabled(on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
      if (enabled) { unlock(); play('pop'); }
    },
    toggle() { this.setEnabled(!enabled); return enabled; }
  };

  // 首次交互解锁音频
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  });

  // 采样文件提前拉下来（不需要 AudioContext），保证第一次点击就有声音
  prefetchSamples();
})();
