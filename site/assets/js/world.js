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

  /* ------------------------------------------------------------ 章节配置 */
  const SECTIONS = [
    {
      id: 'origin', label: '万物互联',
      clip: 'assets/vid/origin.mp4', clipMobile: 'assets/vid/m_origin.mp4',
      still: 'assets/img/poster_origin.jpg',
      accent: '#4de3ff',
      eyebrow: '一切皆节点',
      title: '万物互联，光在彼此之间找到路径',
      body: '每一件物体、每一段数据、每一次心跳，都可以成为这张网络里的一个节点。连接不是附加功能，而是存在本身的方式。',
      tags: ['物联网', '边缘智能', '开放协议'],
      scroll: 1.45, overlayEnter: 0, overlayExit: 0.72
    },
    {
      id: 'ai', label: '人与 AI',
      clip: 'assets/vid/ai.mp4', clipMobile: 'assets/vid/m_ai.mp4',
      still: 'assets/img/poster_ai.jpg',
      accent: '#a06bff',
      eyebrow: '人与 AI',
      title: 'AI 不是替代者，是另一个邻居',
      body: '当机器开始理解语境，它就不再只是工具，而是关系里的另一个成员。它记得你的节奏，也尊重你的边界。',
      tags: ['智能体', '上下文', '人机协同'],
      scroll: 1.5, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'human', label: '人与人',
      clip: 'assets/vid/human.mp4', clipMobile: 'assets/vid/m_human.mp4',
      still: 'assets/img/poster_human.jpg',
      accent: '#ffb765',
      eyebrow: '人与人',
      title: '人与人之间，重新长出连接',
      body: '在一个人人都在线的时代，真正稀缺的依然是信任。我们把技术用在让人重新相遇的地方，而不是让相遇变少。',
      tags: ['社群', '信任', '真实关系'],
      scroll: 1.5, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'mesh', label: '万物共网',
      clip: 'assets/vid/mesh.mp4', clipMobile: 'assets/vid/m_mesh.mp4',
      still: 'assets/img/poster_mesh.jpg',
      accent: '#6bd8ff',
      eyebrow: '万物共网',
      title: '一张网，而不是一堆孤岛',
      body: '节点越多，价值越大。开放的协议与可验证的规则，让任何人都能接进这张正在自己生长的网。',
      tags: ['开放协议', '可验证', '自生长'],
      scroll: 1.4, overlayEnter: 0.02, overlayExit: 0.96
    },
    {
      id: 'join', label: '加入社群',
      clip: 'assets/vid/join.mp4', clipMobile: 'assets/vid/m_join.mp4',
      still: 'assets/img/poster_join.jpg',
      accent: '#eaf6ff',
      eyebrow: '加入我们',
      title: '下一根连接，从你开始',
      body: '这里聚集着正在做 AI 的人、正在造物的人、正在寻找同路的人。进来，把你的节点接上这张网。',
      tags: [],
      scroll: 1.2, overlayEnter: 0, overlayExit: 1,
      cta: {
        primary: { label: '申请加入', href: '#join' },
        secondary: { label: '回到顶部', href: '#top' }
      }
    }
  ];

  const CONNECTORS = [
    'assets/vid/conn0.mp4', 'assets/vid/conn1.mp4',
    'assets/vid/conn2.mp4', 'assets/vid/conn3.mp4'
  ];

  const CONNECTORS_M = [
    'assets/vid/m_conn0.mp4', 'assets/vid/m_conn1.mp4',
    'assets/vid/m_conn2.mp4', 'assets/vid/m_conn3.mp4'
  ];

  /* ------------------------------------------------- 挂载插件的滚动引擎 */
  const world = document.getElementById('world');
  mountScrollWorld(world, {
    brand: { name: 'NEXUS 织网', href: '#top' },
    cta: { label: '申请加入', href: '#join' },
    hint: '滚动进入 · 移动鼠标让网络回应你',
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
  // （文案透明度 / 视频定位）会停留在恢复过程中的中间值。这里强制回到顶部，
  // scrollTo 会派发真实的 scroll 事件，引擎随即重算全部章节状态。
  function resetToTop() {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
    else window.dispatchEvent(new Event('scroll'));
  }
  window.addEventListener('load', () => setTimeout(resetToTop, 80));
  if (document.readyState === 'complete') setTimeout(resetToTop, 80);
  setTimeout(resetToTop, 240);

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
