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
    unlock,
    get enabled() { return enabled; },
    get unlocked() { return unlocked; },
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
})();
