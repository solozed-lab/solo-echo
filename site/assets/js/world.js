/* ============================================================================
   world.js — 页面编排：滚动时间轴 ↔ 章节 ↔ 粒子场 ↔ 传感器 ↔ 语言
   ----------------------------------------------------------------------------
   层级：
     L0 背景视频层  插件的 scrub-engine 按滚动 scrub（assets/vid/*.mp4）
     L1 实时粒子层  本文件创建的 WebGL 粒子场（唯一响应输入的一层）
     L2 文字层      插件的 DOM 排版 / CTA
   语言：
     插件在挂载时把文案写进 DOM，之后不再碰文字。
     所以切换语言 = 原地改写 DOM 文本（不重挂载、不丢滚动位置）。
   ========================================================================== */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  // 滚动叙事页必须从首屏开始：关掉浏览器的滚动恢复，
  // 否则刷新/重载后可能直接落在页面末尾（章节末端），像"跳过开场"。
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ==========================================================
     章节骨架：与语言无关的部分（素材路径 / 强调色 / 滚动长度）
     ========================================================== */
  const SECTION_BASE = [
    { id: 'start', clip: 'assets/vid/origin.mp4', clipMobile: 'assets/vid/m_origin.mp4', still: 'assets/img/poster_origin.jpg', accent: '#4de3ff', scroll: 1.35, overlayEnter: 0, overlayExit: 0.72 },
    { id: 'human-ai', clip: 'assets/vid/ai.mp4', clipMobile: 'assets/vid/m_ai.mp4', still: 'assets/img/poster_ai.jpg', accent: '#a06bff', scroll: 1.40, overlayEnter: 0.02, overlayExit: 0.96 },
    { id: 'ai-ai', clip: 'assets/vid/agents.mp4', clipMobile: 'assets/vid/m_agents.mp4', still: 'assets/img/poster_agents.jpg', accent: '#ff7bd5', scroll: 1.40, overlayEnter: 0.02, overlayExit: 0.96 },
    { id: 'human-human', clip: 'assets/vid/human.mp4', clipMobile: 'assets/vid/m_human.mp4', still: 'assets/img/poster_human.jpg', accent: '#ffb765', scroll: 1.40, overlayEnter: 0.02, overlayExit: 0.96 },
    { id: 'all', clip: 'assets/vid/mesh.mp4', clipMobile: 'assets/vid/m_mesh.mp4', still: 'assets/img/poster_mesh.jpg', accent: '#6bd8ff', scroll: 1.30, overlayEnter: 0.02, overlayExit: 0.96 },
    { id: 'join', clip: 'assets/vid/join.mp4', clipMobile: 'assets/vid/m_join.mp4', still: 'assets/img/poster_join.jpg', accent: '#eaf6ff', scroll: 1.10, overlayEnter: 0, overlayExit: 1 }
  ];

  /* ==========================================================
     文案：两种语言
     ========================================================== */
  const I18N = {
    zh: {
      htmlLang: 'zh-CN',
      title: 'Solo & Echo · 人与 AI、AI 与 AI、人与人，犹如三生万物',
      description: '人与 AI、AI 与 AI、人与人——当三种关系同时成立，新的东西不需要被发明，它自己生长出来。万物不是被造出来的，是被关系带出来的。',
      topCta: '加入',
      hint: '滚动进入 · 移动鼠标，让回声穿过你',
      sections: [
        { label: '起点', eyebrow: '万物 · 起点', title: '一切从一个节点开始', body: '最初的节点是人。连接不是从某台设备开始的，是从一个人愿意开口、把想法放出去开始的。', tags: ['万物', '起点'] },
        { label: '人与 AI', eyebrow: '一 · 人与 AI', title: 'AI 不是工具，而是另一个数字的伙伴', body: '它由数字构成，却不只是一个数字。它有记忆，有判断，也有边界——回应你的，是一直都在的另一方。', tags: ['有记忆', '有判断', '有边界'] },
        { label: 'AI 与 AI', eyebrow: '二 · AI 与 AI', title: '当智能体开始彼此对话', body: '一个模型调用另一个模型，协作、质询、接力。能力不再只属于某一个模型，而属于节点之间刚刚发生的连接。', tags: ['智能体互调', '协作', '接力'] },
        { label: '人与人', eyebrow: '三 · 人与人', title: '人与人之间，重新回归连接', body: '在一个人人都在线的时代，稀缺的从来不是渠道，而是连接本身。我们把技术用在让人重新相遇的地方，而不是让相遇变少。', tags: ['社群', '信任', '真实关系'] },
        { label: '万物', eyebrow: '三生万物', title: '犹如三生万物', body: '人与 AI、AI 与 AI、人与人——当三种关系同时成立，新的东西不需要被发明，它自己生长出来。万物不是被造出来的，是被关系带出来的。', tags: ['自生长', '涌现', '开放'] },
        { label: '加入', eyebrow: '加入我们', title: '让你的回声，被更多节点听见', body: '这里有正在造 AI 的人、正在和人机协作的团队，也有一群自己就会互相连接的智能体。进来，把你的节点接上。', tags: [], cta: { primary: '加入', secondary: '回到顶部' } }
      ],
      hud: {
        toggle: '交互面板', density: '粒子密度', camera: '摄像头', gyro: '陀螺仪', shake: '摇一摇',
        ambient: '环境光', events: '涌现事件', video: '视频层', pulse: '扩散脉冲',
        note: '摄像头画面仅在本机逐帧计算亮度与运动量，不录制、不上传。',
        stat: { particles: '粒子', links: '连线', events: '事件', fps: 'FPS' }
      },
      messages: {
        on: '已开启', off: '已关闭',
        eventsOn: '涌现事件：开', eventsOff: '涌现事件：关',
        videoOn: '视频层：开', videoOff: '视频层：关（仅保留实时粒子）',
        pulse: '扩散脉冲', shake: '摇一摇 · 网络扩散',
        camOn: '摄像头已接管能量与色温',
        fail: '该能力启动失败，已保持关闭',
        camDenied: '摄像头权限被拒绝', camNone: '没有找到摄像头设备',
        camErr: '摄像头启动失败', camFrame: '摄像头帧读取失败'
      }
    },

    en: {
      htmlLang: 'en',
      title: 'Solo & Echo · Human & AI, AI & AI, Human & Human — from three, all things',
      description: 'Human & AI, AI & AI, human & human. Once all three hold at the same time, new things need no invention — they grow. Nothing here is manufactured; it is brought into being by the relationships themselves.',
      topCta: 'Join',
      hint: 'Scroll in · move your mouse, let the echo pass through you',
      sections: [
        { label: 'Origin', eyebrow: 'All Things · Origin', title: 'Everything begins\nwith a single node', body: 'The first node is always a person. Connection does not start with a device — it starts when someone opens their mouth and lets a thought out.', tags: ['All things', 'Origin'] },
        { label: 'Human & AI', eyebrow: 'I · Human & AI', title: 'AI is not a tool,\nbut another\ndigital companion', body: 'Built from digits, never just digits. It has memory, judgment and limits — and it is always there on the other side of your words.', tags: ['Memory', 'Judgment', 'Limits'] },
        { label: 'AI & AI', eyebrow: 'II · AI & AI', title: 'When agents start\ntalking to each other', body: 'One model calls another to collaborate, to challenge, to hand off. Capability no longer belongs to one model — it belongs to the connection that just happened between two nodes.', tags: ['Agent mesh', 'Collaboration', 'Handoff'] },
        { label: 'Human & Human', eyebrow: 'III · Human & Human', title: 'Between people,\nconnection returns', body: 'In an age where everyone is already online, what was scarce was never the channel — it is the connection itself. We build for people meeting again, not for people meeting less.', tags: ['Community', 'Trust', 'Real ties'] },
        { label: 'All Things', eyebrow: 'From three, all things', title: 'From three,\nall things emerge', body: 'Human & AI, AI & AI, human & human — once all three hold at the same time, new things need no invention. They grow. Nothing here is manufactured; it is brought into being by the relationships themselves.', tags: ['Self-growing', 'Emergence', 'Open'] },
        { label: 'Join', eyebrow: 'Join us', title: 'Let your echo be\nheard by more nodes', body: 'People building AI. Teams working alongside machines. Agents that already connect to one another on their own. Come in and plug your node into the graph.', tags: [], cta: { primary: 'Join', secondary: 'Back to top' } }
      ],
      hud: {
        toggle: 'Controls', density: 'Density', camera: 'Camera', gyro: 'Gyroscope', shake: 'Shake',
        ambient: 'Ambient light', events: 'Emergence', video: 'Video layer', pulse: 'Pulse',
        note: 'Camera frames are analyzed on-device for brightness and motion only — never recorded, never uploaded.',
        stat: { particles: 'nodes', links: 'links', events: 'events', fps: 'FPS' }
      },
      messages: {
        on: 'turned on', off: 'turned off',
        eventsOn: 'Emergence: on', eventsOff: 'Emergence: off',
        videoOn: 'Video layer: on', videoOff: 'Video layer: off (live particles only)',
        pulse: 'Pulse', shake: 'Shake · the network expands',
        camOn: 'Camera is now driving energy and color',
        fail: 'Could not start — left switched off',
        camDenied: 'Camera permission denied', camNone: 'No camera device found',
        camErr: 'Could not start the camera', camFrame: 'Could not read camera frames'
      }
    }
  };

  /* ------------------------------------------------- 语言状态
     优先级：?lang=en|zh 参数 > localStorage 记忆 > 默认中文 */
  const LANG_KEY = 'soloecho.lang';
  let lang = 'zh';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh' || q === 'en') {
      lang = q;
    } else {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en') lang = saved;
    }
  } catch (e) { /* 隐私模式下 localStorage 不可用，忽略 */ }

  const T = () => I18N[lang];

  /* ------------------------------------------------- 章节配置 */
  function buildSections(l) {
    const C = I18N[l];
    return SECTION_BASE.map((b, i) => {
      const s = C.sections[i];
      return {
        id: b.id, label: s.label,
        clip: b.clip, clipMobile: b.clipMobile, still: b.still,
        accent: b.accent,
        eyebrow: s.eyebrow, title: s.title, body: s.body, tags: s.tags,
        scroll: b.scroll, overlayEnter: b.overlayEnter, overlayExit: b.overlayExit,
        cta: s.cta
      };
    });
  }

  /* ------------------------------------------------- 挂载插件的滚动引擎 */
  const world = document.getElementById('world');
  mountScrollWorld(world, {
    brand: { name: 'Solo & Echo', href: '#top' },
    cta: { label: I18N[lang].topCta, href: '#join' },
    hint: I18N[lang].hint,
    nav: true,
    atmosphere: true,
    diveScroll: 1.3,
    connScroll: 0.5,
    crossfade: 0.14,
    sections: buildSections(lang),
    connectors: [
      'assets/vid/conn0.mp4', 'assets/vid/conn1.mp4', 'assets/vid/conn2.mp4',
      'assets/vid/conn3.mp4', 'assets/vid/conn4.mp4'
    ],
    connectorsMobile: [
      'assets/vid/m_conn0.mp4', 'assets/vid/m_conn1.mp4', 'assets/vid/m_conn2.mp4',
      'assets/vid/m_conn3.mp4', 'assets/vid/m_conn4.mp4'
    ]
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
    SECTION_BASE.forEach((s, i) => {
      segs.push({ kind: 'dive', si: i, w: s.scroll || DIVE_W });
      if (i < SECTION_BASE.length - 1) segs.push({ kind: 'conn', si: i, w: CONN_W });
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
      a = seg.si; b = Math.min(SECTION_BASE.length - 1, seg.si + 1);
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
    if (e.target && e.target.closest && e.target.closest('.sw-btn, .sw-nav__item, .sw-route__dot, .sw-hud, .sw-lang')) return;
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
      field.addShock(window.innerWidth * 0.5, window.innerHeight * 0.5, 1.2);
      flash(T().messages.shake);
    }
  });

  /* --------------------------------------------------------------- HUD */
  const hud = document.createElement('aside');
  hud.className = 'sw-hud';
  hud.innerHTML = `
    <button class="sw-hud__toggle" type="button" aria-expanded="false">
      <span class="sw-hud__dot"></span><span data-i18n="toggle"></span>
    </button>
    <div class="sw-hud__panel" hidden>
      <div class="sw-hud__row">
        <label for="sw-density" data-i18n="density"></label>
        <input id="sw-density" type="range" min="20" max="100" value="${coarse ? 50 : 78}">
        <output id="sw-density-out">${coarse ? 50 : 78}</output>
      </div>
      <div class="sw-hud__row sw-hud__row--btns">
        <button type="button" data-sensor="camera" data-i18n="camera"></button>
        <button type="button" data-sensor="orientation" data-i18n="gyro"></button>
        <button type="button" data-sensor="motion" data-i18n="shake"></button>
        <button type="button" data-sensor="ambient" data-i18n="ambient"></button>
      </div>
      <div class="sw-hud__row sw-hud__row--btns">
        <button type="button" data-toggle="events" data-i18n="events"></button>
        <button type="button" data-toggle="video" data-i18n="video"></button>
        <button type="button" data-action="shock" data-i18n="pulse"></button>
      </div>
      <div class="sw-hud__stat" id="sw-stat">—</div>
      <p class="sw-hud__note" data-i18n="note"></p>
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
    if (!s || !s.supported) { btn.disabled = true; btn.title = '当前设备不支持 / not supported on this device'; return; }
    btn.addEventListener('click', async () => {
      btn.classList.add('is-loading');
      const ok = await s.toggle();
      btn.classList.remove('is-loading');
      btn.classList.toggle('is-on', !!s.active);
      if (!ok) msg((s.error || T().messages.fail) + '，' + (lang === 'zh' ? '已保持关闭' : 'left off'), null);
      else msg(s.active ? T().messages.on + '：' + btn.textContent : T().messages.off + '：' + btn.textContent, 'ok');
      updateHudState();
    });
  });

  hud.querySelector('[data-toggle="events"]').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('is-on');
    e.currentTarget.classList.toggle('is-on', on);
    field.setEvents(on);
    msg(on ? T().messages.eventsOn : T().messages.eventsOff);
  });
  hud.querySelector('[data-toggle="events"]').classList.add('is-on');

  const videoBtn = hud.querySelector('[data-toggle="video"]');
  videoBtn.classList.add('is-on');
  videoBtn.addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('is-on');
    e.currentTarget.classList.toggle('is-on', on);
    document.documentElement.classList.toggle('sw-novideo', !on);
    msg(on ? T().messages.videoOn : T().messages.videoOff);
  });

  hud.querySelector('[data-action="shock"]').addEventListener('click', () => {
    field.addShock(window.innerWidth * 0.5, window.innerHeight * 0.5, 1.4);
    flash(T().messages.pulse);
  });

  function updateHudState() {
    const st = sensors.state;
    if (st.camera) msg(T().messages.camOn, 'ok');
  }

  /* --------------------------------------------------------- 状态读数 */
  let statTick = 0;
  function statsLoop(now) {
    requestAnimationFrame(statsLoop);
    if (now - statTick < 500) return;
    statTick = now;
    const s = field.stats();
    const st = sensors.state;
    const K = T().hud.stat;
    const bits = [
      K.particles + ' ' + s.particles,
      K.links + ' ' + s.lines,
      K.events + ' ' + s.events,
      s.fps + ' ' + K.fps
    ];
    if (st.camera) bits.push(st.camera ? 'CAM ' + Math.round(st.motionLevel * 100) + '%' : '');
    if (st.orientation) bits.push('GYRO');
    hudStat.textContent = bits.filter(Boolean).join(' · ');
  }
  requestAnimationFrame(statsLoop);

  /* ==========================================================
     语言切换：原地改写 DOM（不重挂载、不丢滚动位置）
     ========================================================== */
  const topbar = world.querySelector('.sw-topbar');
  const topCta = topbar ? topbar.querySelector('.sw-topcta') : null;
  const rightGroup = document.createElement('div');
  rightGroup.className = 'sw-topright';

  const langToggle = document.createElement('div');
  langToggle.className = 'sw-lang';
  langToggle.setAttribute('role', 'group');
  langToggle.setAttribute('aria-label', 'Language / 语言');
  langToggle.innerHTML =
    '<button type="button" data-lang="zh" lang="zh-CN">中</button>' +
    '<button type="button" data-lang="en" lang="en">EN</button>';
  rightGroup.appendChild(langToggle);
  if (topCta) rightGroup.appendChild(topCta);
  if (topbar) topbar.appendChild(rightGroup);

  function applyLang(next, persist) {
    if (!I18N[next]) return;
    lang = next;
    const C = I18N[lang];

    document.documentElement.lang = C.htmlLang;
    document.title = C.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', C.description);

    // 品牌（双语同名）
    const brandName = world.querySelector('.sw-brand__name');
    if (brandName) brandName.textContent = 'Solo & Echo';
    if (topCta) topCta.textContent = C.topCta;

    // 滚动提示
    const hintText = world.querySelector('.sw-hint span');
    if (hintText) hintText.textContent = C.hint;

    // 顶部导航胶囊
    const navItems = world.querySelectorAll('.sw-nav__item');
    navItems.forEach((b, i) => { const s = C.sections[i]; if (s) b.textContent = s.label; });

    // 右侧章节圆点标签
    const dotLabels = world.querySelectorAll('.sw-route__label');
    dotLabels.forEach((el, i) => { const s = C.sections[i]; if (s) el.textContent = s.label; });

    // 文案层
    const copies = world.querySelectorAll('.sw-copy');
    copies.forEach((c, i) => {
      const s = C.sections[i];
      if (!s) return;
      const eyebrow = c.querySelector('.sw-copy__eyebrow');
      if (eyebrow) eyebrow.textContent = s.eyebrow;
      const title = c.querySelector('.sw-copy__title');
      if (title) title.textContent = s.title;
      const body = c.querySelector('.sw-copy__body');
      if (body) body.textContent = s.body;
      const tags = c.querySelectorAll('.sw-copy__tags li');
      tags.forEach((li, k) => { if (s.tags[k] != null) li.textContent = s.tags[k]; });
      const btns = c.querySelectorAll('.sw-copy__cta .sw-btn');
      if (s.cta && btns.length) {
        if (btns[0]) btns[0].textContent = s.cta.primary;
        if (btns[1]) btns[1].textContent = s.cta.secondary;
      }
    });

    // HUD 文案
    hud.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (C.hud[k] != null) el.textContent = C.hud[k];
    });

    // 按钮状态
    langToggle.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.lang === lang));

    if (persist !== false) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* 忽略 */ }
    }
  }

  langToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    applyLang(btn.dataset.lang, true);
  });

  applyLang(lang, false);

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
})();
