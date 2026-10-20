/* ============================================================================
   world.js — 页面编排：滚动时间轴 ↔ 章节 ↔ 粒子场 ↔ 传感器
   ----------------------------------------------------------------------------
   层级：
     L0 背景视频层  插件的 scrub-engine 按滚动 scrub（assets/vid/*.mp4）
     L1 实时粒子层  本文件创建的 WebGL 粒子场（唯一响应输入的一层）
     L2 文字层      插件的 DOM 排版 / CTA
   ========================================================================== */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  // 滚动叙事页必须从首屏开始：关掉浏览器的滚动恢复，
  // 否则刷新/重载后可能直接落在页面末尾（章节末端），像"跳过开场"。
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ------------------------------------------------------------ 章节配置
     主题：人与 AI、AI 与 AI、人与人 —— 三种关系，衍生出万物
     骨架取自「道生一，一生二，二生三，三生万物」：
       万物·起点(人) → 一(人与 AI) → 二(AI 与 AI) → 三(人与人) → 三生万物 → 加入
     粒子形态与之呼应：球云 / 双极 / 双格栅 / 簇群 / 球壳 / 拱门 */
  const SECTIONS = [
    {
      id: 'start', label: '起点',
      clip: 'assets/vid/origin.mp4', clipMobile: 'assets/vid/m_origin.mp4',
      still: 'assets/img/poster_origin.jpg',
      accent: '#4de3ff',
      eyebrow: '万物 · 起点',
      title: '一切从一个节点开始',
      body: '最初的节点是人。连接不是从某台设备开始的，是从一个人愿意开口、把想法放出去开始的。',
      tags: ['万物', '起点'],
      scroll: 1.35, overlayEnter: 0, overlayExit: 0.72
    },
    {
      id: 'human-ai', label: '人与 AI',
      clip: 'assets/vid/ai.mp4', clipMobile: 'assets/vid/m_ai.mp4',
      still: 'assets/img/poster_ai.jpg',
      accent: '#a06bff',
      eyebrow: '一 · 人与 AI',
      title: 'AI 不是工具，而是另一个数字的伙伴',
      body: '它由数字构成，却不只是一个数字。它有记忆，有判断，也有边界——回应你的，是一直都在的另一方。',
      tags: ['有记忆', '有判断', '有边界'],
      scroll: 1.4, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'ai-ai', label: 'AI 与 AI',
      clip: 'assets/vid/agents.mp4', clipMobile: 'assets/vid/m_agents.mp4',
      still: 'assets/img/poster_agents.jpg',
      accent: '#ff7bd5',
      eyebrow: '二 · AI 与 AI',
      title: '当智能体开始彼此对话',
      body: '一个模型调用另一个模型，协作、质询、接力。能力不再只属于某一个模型，而属于节点之间刚刚发生的连接。',
      tags: ['智能体互调', '协作', '接力'],
      scroll: 1.4, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'human-human', label: '人与人',
      clip: 'assets/vid/human.mp4', clipMobile: 'assets/vid/m_human.mp4',
      still: 'assets/img/poster_human.jpg',
      accent: '#ffb765',
      eyebrow: '三 · 人与人',
      title: '人与人之间，重新回归连接',
      body: '在一个人人都在线的时代，稀缺的从来不是渠道，而是连接本身。我们把技术用在让人重新相遇的地方，而不是让相遇变少。',
      tags: ['社群', '信任', '真实关系'],
      scroll: 1.4, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'all', label: '万物',
      clip: 'assets/vid/mesh.mp4', clipMobile: 'assets/vid/m_mesh.mp4',
      still: 'assets/img/poster_mesh.jpg',
      accent: '#6bd8ff',
      eyebrow: '三生万物',
      title: '犹如三生万物',
      body: '人与 AI、AI 与 AI、人与人——当三种关系同时成立，新的东西不需要被发明，它自己生长出来。万物不是被造出来的，是被关系带出来的。',
      tags: ['自生长', '涌现', '开放'],
      scroll: 1.3, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'join', label: '加入',
      clip: 'assets/vid/join.mp4', clipMobile: 'assets/vid/m_join.mp4',
      still: 'assets/img/poster_join.jpg',
      accent: '#eaf6ff',
      eyebrow: '加入我们',
      title: '让你的回声，被更多节点听见',
      body: '这里有正在造 AI 的人、正在和人机协作的团队，也有一群自己就会互相连接的智能体。进来，把你的节点接上。',
      tags: [],
      scroll: 1.1, overlayEnter: 0, overlayExit: 1,
      cta: {
        primary: { label: '加入', href: '#join' },
        secondary: { label: '回到顶部', href: '#top' }
      }
    }
  ];

  const CONNECTORS = [
    'assets/vid/conn0.mp4', 'assets/vid/conn1.mp4', 'assets/vid/conn2.mp4',
    'assets/vid/conn3.mp4', 'assets/vid/conn4.mp4'
  ];

  const CONNECTORS_M = [
    'assets/vid/m_conn0.mp4', 'assets/vid/m_conn1.mp4', 'assets/vid/m_conn2.mp4',
    'assets/vid/m_conn3.mp4', 'assets/vid/m_conn4.mp4'
  ];

  /* ------------------------------------------------- 挂载插件的滚动引擎 */
  const world = document.getElementById('world');
  mountScrollWorld(world, {
    brand: { name: 'Solo & Echo', href: '#top' },
    cta: { label: '加入', href: '#join' },
    hint: '滚动进入 · 移动鼠标，让回声穿过你',
    nav: true,
    atmosphere: true,
    diveScroll: 1.3,
    connScroll: 0.5,
    crossfade: 0.14,
    sections: SECTIONS,
    connectors: CONNECTORS,
    connectorsMobile: CONNECTORS_M
  });

  /* 引擎把轨道高度设成 (总长 + 1vh)，于是"最大滚动位置"正好等于最后一段的结束点，
     再减去浏览器的亚像素取整，最后一章会被判为"已经越过"，终屏 CTA 永远不显示。
     给轨道一个 12px 的负下边距，把最大滚动位置拉回最后一段之内。
     引擎只写 height，不会覆盖 margin。 */
  const swTrack = world.querySelector('.sw-track');
  if (swTrack) swTrack.style.marginBottom = '-12px';

  /* ---------------------------------------------- 实时粒子层（互动主角） */
  const canvas = document.createElement('canvas');
  canvas.className = 'sw-field';
  canvas.setAttribute('aria-hidden', 'true');
  world.appendChild(canvas);

  const field = window.SWField.create(canvas, { reduce: reduce, coarse: coarse });
  field.setDensity(coarse ? 0.5 : 0.78);

  /* ------------------------------------------------ 章节时间轴（与引擎一致） */
  const DIVE_W = 1.3, CONN_W = 0.5;
  let SEGMENTS = [];

  function buildTimeline() {
    const segs = [];
    SECTIONS.forEach((s, i) => {
      segs.push({ kind: 'dive', si: i, w: s.scroll || DIVE_W });
      if (i < SECTIONS.length - 1 && CONNECTORS[i]) {
        segs.push({ kind: 'conn', si: i, w: CONN_W });
      }
    });
    const vh = window.innerHeight;
    let off = 0;
    segs.forEach(s => { s.start = off * vh; off += s.w; s.end = off * vh; });
    return { segs, total: off * vh };
  }

  function updateChapter() {
    if (!SEGMENTS.length) return;
    const y = window.scrollY || window.pageYOffset;
    let ci = 0;
    for (let i = 0; i < SEGMENTS.length; i++) if (y >= SEGMENTS[i].start) ci = i;
    const seg = SEGMENTS[ci];
    const p = Math.max(0, Math.min(1, (y - seg.start) / (seg.end - seg.start)));

    let a, b, mix;
    if (seg.kind === 'dive') {
      const hasConn = ci + 1 < SEGMENTS.length && SEGMENTS[ci + 1].kind === 'conn';
      a = seg.si; b = Math.min(SECTIONS.length - 1, seg.si + 1);
      // 章节尾段预热下一章；有连接段时只预热到 0.35，接上连接段继续
      const pre = hasConn ? 0.35 : 1.0;
      mix = pre * Math.max(0, Math.min(1, (p - 0.78) / 0.22));
      mix = mix * mix * (3 - 2 * mix);
    } else {
      a = seg.si; b = seg.si + 1;
      const t = Math.max(0, Math.min(1, (p - 0.15) / 0.7));
      mix = 0.35 + 0.65 * (t * t * (3 - 2 * t));
    }
    field.setChapter(a, b, mix);
  }

  /* ------------------------------------------------------- 指针 / 触摸 */
  let px = -9999, py = -9999, lastX = -9999, lastY = -9999, lastMoveT = 0;
  let smoothVX = 0, smoothVY = 0;

  function onPointer(e) {
    const now = performance.now();
    const dt = Math.max(8, now - lastMoveT);
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (lastX > -1000) {
      const ivx = (dx / dt) * 16, ivy = (dy / dt) * 16;
      smoothVX = smoothVX * 0.7 + ivx * 0.3;
      smoothVY = smoothVY * 0.7 + ivy * 0.3;
    }
    lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
    px = e.clientX; py = e.clientY;
    field.setPointer(px, py, smoothVX, smoothVY, true);
  }

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerleave', () => field.setPointer(-9999, -9999, 0, 0, false));
  window.addEventListener('pointerdown', (e) => {
    if (e.target && e.target.closest && e.target.closest('.sw-btn, .sw-nav__item, .sw-route__dot, .sw-hud')) return;
    field.setPointer(e.clientX, e.clientY, 0, 0, true);
    field.addShock(e.clientX, e.clientY, 1);
  }, { passive: true });

  /* ----------------------------------------------------------- 尺寸同步 */
  function resizeField() {
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    field.resize(window.innerWidth, window.innerHeight, dpr);
  }
  window.addEventListener('resize', () => { resizeField(); SEGMENTS = buildTimeline(); updateChapter(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { resizeField(); SEGMENTS = buildTimeline(); }, 260));
  resizeField();
  SEGMENTS = buildTimeline();
  updateChapter();

  /* ------------------------------------------------------------- 传感器 */
  const sensors = window.SWSensors.create(field, {
    onState: () => updateHudState(),
    onShake: () => {
      const r = Math.min(window.innerWidth, window.innerHeight);
      field.addShock(window.innerWidth * 0.5, window.innerHeight * 0.5, 1.2);
      flash('摇一摇 · 网络扩散');
    }
  });

  /* --------------------------------------------------------------- HUD */
  const hud = document.createElement('aside');
  hud.className = 'sw-hud';
  hud.innerHTML = `
    <button class="sw-hud__toggle" type="button" aria-expanded="false">
      <span class="sw-hud__dot"></span><span>交互面板</span>
    </button>
    <div class="sw-hud__panel" hidden>
      <div class="sw-hud__row">
        <label for="sw-density">粒子密度</label>
        <input id="sw-density" type="range" min="20" max="100" value="${coarse ? 50 : 78}">
        <output id="sw-density-out">${coarse ? 50 : 78}</output>
      </div>
      <div class="sw-hud__row sw-hud__row--btns">
        <button type="button" data-sensor="camera">摄像头</button>
        <button type="button" data-sensor="orientation">陀螺仪</button>
        <button type="button" data-sensor="motion">摇一摇</button>
        <button type="button" data-sensor="ambient">环境光</button>
      </div>
      <div class="sw-hud__row sw-hud__row--btns">
        <button type="button" data-toggle="events">涌现事件</button>
        <button type="button" data-toggle="video">视频层</button>
        <button type="button" data-action="shock">扩散脉冲</button>
      </div>
      <div class="sw-hud__stat" id="sw-stat">—</div>
      <p class="sw-hud__note">摄像头画面仅在本机逐帧计算亮度与运动量，不录制、不上传。</p>
      <p class="sw-hud__msg" id="sw-msg"></p>
    </div>`;
  document.body.appendChild(hud);

  const hudToggle = hud.querySelector('.sw-hud__toggle');
  const hudPanel = hud.querySelector('.sw-hud__panel');
  const hudStat = hud.querySelector('#sw-stat');
  const hudMsg = hud.querySelector('#sw-msg');
  const density = hud.querySelector('#sw-density');
  const densityOut = hud.querySelector('#sw-density-out');

  hudToggle.addEventListener('click', () => {
    const open = hudPanel.hasAttribute('hidden');
    if (open) hudPanel.removeAttribute('hidden'); else hudPanel.setAttribute('hidden', '');
    hudToggle.setAttribute('aria-expanded', String(open));
    hud.classList.toggle('is-open', open);
  });

  density.addEventListener('input', () => {
    densityOut.textContent = density.value;
    field.setDensity(Number(density.value) / 100);
  });

  function msg(text, tone) {
    hudMsg.textContent = text || '';
    hudMsg.dataset.tone = tone || '';
    if (text) setTimeout(() => { if (hudMsg.textContent === text) hudMsg.textContent = ''; }, 5200);
  }

  function flash(text) {
    let f = document.querySelector('.sw-flash');
    if (!f) {
      f = document.createElement('div');
      f.className = 'sw-flash';
      document.body.appendChild(f);
    }
    f.textContent = text;
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  }

  hud.querySelectorAll('[data-sensor]').forEach(btn => {
    const which = btn.dataset.sensor;
    const s = sensors[which];
    if (!s || !s.supported) { btn.disabled = true; btn.title = '当前设备不支持'; return; }
    btn.addEventListener('click', async () => {
      btn.classList.add('is-loading');
      const ok = await s.toggle();
      btn.classList.remove('is-loading');
      btn.classList.toggle('is-on', !!s.active);
      if (!ok) msg((s.error || '该能力启动失败') + '，已保持关闭');
      else msg(s.active ? '已开启：' + btn.textContent : '已关闭：' + btn.textContent, 'ok');
      updateHudState();
    });
  });

  hud.querySelector('[data-toggle="events"]').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('is-on');
    e.currentTarget.classList.toggle('is-on', on);
    field.setEvents(on);
    msg(on ? '涌现事件：开' : '涌现事件：关');
  });
  hud.querySelector('[data-toggle="events"]').classList.add('is-on');

  const videoBtn = hud.querySelector('[data-toggle="video"]');
  videoBtn.classList.add('is-on');
  videoBtn.addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('is-on');
    e.currentTarget.classList.toggle('is-on', on);
    document.documentElement.classList.toggle('sw-novideo', !on);
    msg(on ? '视频层：开' : '视频层：关（仅保留实时粒子）');
  });

  hud.querySelector('[data-action="shock"]').addEventListener('click', () => {
    field.addShock(window.innerWidth * 0.5, window.innerHeight * 0.5, 1.4);
    flash('扩散脉冲');
  });

  function updateHudState() {
    const st = sensors.state;
    if (st.camera) msg('摄像头已接管能量与色温', 'ok');
  }

  /* --------------------------------------------------------- 状态读数 */
  let statTick = 0;
  function statsLoop(now) {
    requestAnimationFrame(statsLoop);
    if (now - statTick < 500) return;
    statTick = now;
    const s = field.stats();
    const st = sensors.state;
    const bits = [
      '粒子 ' + s.particles,
      '连线 ' + s.lines,
      '事件 ' + s.events,
      s.fps + ' FPS'
    ];
    if (st.camera) bits.push('摄像头 ' + Math.round(st.motionLevel * 100) + '%');
    if (st.orientation) bits.push('陀螺仪');
    hudStat.textContent = bits.join(' · ');
  }
  requestAnimationFrame(statsLoop);

  /* --------------------------------------------------------- 滚动同步 */
  function scrollLoop() {
    requestAnimationFrame(scrollLoop);
    updateChapter();
  }
  requestAnimationFrame(scrollLoop);

  /* ------------------------------------------------------------ 启动 */
  // 首屏归位：浏览器的滚动恢复可能把页面停在底部，而引擎的章节状态
  // （文案透明度 / 视频定位）会停留在恢复过程中的中间值。
  // 浏览器的恢复时机不确定（可能在 load 之后才发生），所以多试几次；
  // 用户一旦自己滚动了就不再打扰。
  let userScrolled = false;
  const markScrolled = () => { userScrolled = true; };
  window.addEventListener('wheel', markScrolled, { passive: true });
  window.addEventListener('touchstart', markScrolled, { passive: true });
  window.addEventListener('pointerdown', markScrolled, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].indexOf(e.key) >= 0) markScrolled();
  });

  function resetToTop() {
    if (userScrolled) return;
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    else window.dispatchEvent(new Event('scroll'));
  }
  window.addEventListener('pageshow', () => setTimeout(resetToTop, 50));
  window.addEventListener('load', () => {
    setTimeout(resetToTop, 60);
    setTimeout(resetToTop, 400);
    setTimeout(resetToTop, 1200);
  });
  if (document.readyState === 'complete') setTimeout(resetToTop, 60);

  if (reduce) {
    field.renderStatic();
    document.documentElement.classList.add('sw-reduced');
  } else {
    field.start();
  }

  /* 页面切到后台时停掉渲染，恢复时重新同步 */
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden) field.stop();
    else { updateChapter(); field.start(); }
  });

  /* 首屏手势：iOS 需要一次用户交互才让视频解码（引擎内部也处理了一份） */
  window.addEventListener('pointerdown', function prime() {
    field.addShock(window.innerWidth * 0.5, window.innerHeight * 0.62, 0.9);
  }, { once: true, passive: true });
})();
