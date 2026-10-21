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
     切屏音：每章一句，直接取自宣传片那一章的动机
     ------------------------------------------------------------------
     乐谱：K:Em，M:2/4，L:1/8，120BPM，动机 = 回声 E–B–e–B。
     站点不另造一套音 —— 影片里每一章本来就有自己的动机变体，
     这里按同样的动机写回 Web Audio，站点和片子就是同一件乐器。

     递进的方式不是"音越来越响"，而是三件事同时发生：
       · 音区往上走（起点在 E4，人与人在 G4–F5，万物升到 E5–E6）
       · 层数变多（起点只有拨弦，加入有三和弦 + 低频落点）
       · 质感变厚（气流从窄到宽，泛音从少到多）
     ------------------------------------------------------------------ */
  const CHAPTER_SOUND = [
    // 起点：一记孤立的动机，几乎只有弦
    { f: [329.63, 493.88, 659.26, 493.88], step: 0.125, dur: 0.24, gain: 0.115,
      air: [260, 1700], airGain: 0.090, airDur: 0.52, q: 0.8, sub: 0 },
    // 人与 AI：多一个中音与泛音 —— 对面有东西了
    { f: [329.63, 493.88, 659.26, 493.88, 392.00, 493.88], step: 0.115, dur: 0.26, gain: 0.115,
      air: [300, 2200], airGain: 0.130, airDur: 0.46, q: 0.9, sub: 98 },
    // AI 与 AI：动机原地重复 + 机械的短促 —— 两个模型互调
    { f: [329.63, 493.88, 659.26, 493.88, 329.63, 493.88, 659.26, 493.88], step: 0.095, dur: 0.19, gain: 0.105,
      air: [420, 3200], airGain: 0.140, airDur: 0.38, q: 1.3, sub: 98, tick: true },
    // 人与人：上行滑音 —— 全片唯一有体温的一段
    { f: [392.00, 493.88, 659.26, 493.88, 440.00, 523.25, 659.26, 523.25, 587.33], step: 0.105, dur: 0.28, gain: 0.105,
      air: [240, 2000], airGain: 0.130, airDur: 0.52, q: 0.8, sub: 82, sweep: true },
    // 万物：升八度 + 纯五度 —— 三种关系同时成立
    { f: [659.26, 987.77, 1318.51, 987.77, 783.99, 987.77], step: 0.105, dur: 0.30, gain: 0.105,
      air: [500, 3800], airGain: 0.165, airDur: 0.50, q: 0.9, sub: 98, fifth: true },
    // 加入：拉宽落回 E 小调三和弦 —— 收束
    { f: [329.63, 493.88, 659.26, 493.88], step: 0.20, dur: 0.80, gain: 0.125,
      air: [220, 2400], airGain: 0.140, airDur: 0.85, q: 0.8, sub: 65, fifth: true, chord: true }
  ];

  /* 拨弦：三角波主体 + 二次/三次谐波，快衰减 —— 接近影片里的 synpluck */
  function pluck(freq, t0, dur, gain) {
    tone('triangle', freq, freq * 0.994, dur, gain, t0);
    tone('sine', freq * 2, freq * 1.99, dur * 0.52, gain * 0.24, t0);
    tone('sine', freq * 3, freq * 2.98, dur * 0.26, gain * 0.08, t0);
  }

  /* 上行滑音：弦乐/人声向的连音，比纯拨弦更"有体温" */
  function pluckSweep(freq, t0, dur, gain) {
    tone('sine', freq * 0.90, freq, dur * 0.78, gain * 0.95, t0);
    tone('triangle', freq * 0.94, freq, dur * 0.62, gain * 0.34, t0);
    tone('sine', freq * 2, freq * 1.99, dur * 0.34, gain * 0.15, t0);
  }

  let lastChapterAt = -1;
  const diag = { chapter: -1, voices: [], count: 0 };

  function playChapter(i) {
    const c = CHAPTER_SOUND[i];
    if (!c) return;
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx || ctx.state !== 'running') return;
    // 快速连滚时不叠音：同一个切屏音至少隔 0.2s
    const t = now();
    if (t - lastChapterAt < 0.2) return;
    lastChapterAt = t;

    const t0 = t + 0.012;
    c.f.forEach((f, k) => {
      const at = t0 + k * c.step;
      if (c.sweep) pluckSweep(f, at, c.dur, c.gain);
      else pluck(f, at, c.dur, c.gain);
      if (c.fifth) tone('sine', f * 1.5, f * 1.49, c.dur * 0.9, c.gain * 0.30, at);
    });

    // 机械段：每两个音夹一记短促的高频，像机械钟
    if (c.tick) {
      for (let k = 0; k < c.f.length; k += 2) {
        tone('square', 2600, 2480, 0.022, 0.032, t0 + k * c.step);
      }
    }

    // 收束：E 小调三和弦铺底
    if (c.chord) {
      [329.63, 392.00, 493.88, 659.26].forEach((f, k) => {
        tone('sine', f, f, c.dur * (1.5 + k * 0.12), 0.052 - k * 0.006, t0 + 0.04);
      });
    }

    // 气流：切屏的那一下风
    noise(c.airDur, c.airGain, c.air[0], c.air[1], c.q, 'bandpass');

    // 低频落点：越往后越沉
    if (c.sub) {
      tone('sine', c.sub, c.sub * 0.45, 0.34, 0.145, t0);
    }

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
    unlock,
    get enabled() { return enabled; },
    get unlocked() { return unlocked; },
    /* 只读诊断：验收脚本用来确认"每章确实是不同的动机" */
    get diag() { return { chapter: diag.chapter, voices: diag.voices.slice(), count: diag.count }; },
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
