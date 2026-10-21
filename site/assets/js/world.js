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

  /* 关键词相关状态：提前声明。
     syncLiveCopy() 在挂载早期（updateChapter 首次调用）就会被触发，
     声明必须早于那次调用，否则会撞上 let 的暂时性死区。 */
  let liveCopyIdx = -1;
  let demoKey = '';

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
      hint: '滚动进入 · 移动鼠标 · 点亮的关系词可以点开',
      sections: [
        { label: '起点', eyebrow: '万物 · 起点', title: '一切从一个节点开始', body: '最初的节点是人。连接不是从某台设备开始的，是从一个人愿意开口、把想法放出去开始的。', tags: ['万物', '起点'], tagKeys: ['emergence', null] },
        { label: '人与 AI', eyebrow: '一 · 人与 AI', title: 'AI 不是工具，而是另一个数字的伙伴', body: '它由数字构成，却不只是一个数字。它有记忆，有判断，也有边界——回应你的，是一直都在的另一方。', tags: ['有记忆', '有判断', '有边界'], tagKeys: ['memory', 'judgment', 'bounds'] },
        { label: 'AI 与 AI', eyebrow: '二 · AI 与 AI', title: '当智能体开始彼此对话', body: '一个模型调用另一个模型，协作、质询、接力。能力不再只属于某一个模型，而属于节点之间刚刚发生的连接。', tags: ['智能体互调', '协作', '接力'], tagKeys: ['handoff', 'bridge', 'handoff'] },
        { label: '人与人', eyebrow: '三 · 人与人', title: '人与人之间，重新回归连接', body: '在一个人人都在线的时代，稀缺的从来不是渠道，而是连接本身。我们把技术用在让人重新相遇的地方，而不是让相遇变少。', tags: ['社群', '信任', '真实关系'], tagKeys: ['trust', 'trust', 'trust'] },
        { label: '万物', eyebrow: '三生万物', title: '犹如三生万物', body: '人与 AI、AI 与 AI、人与人——当三种关系同时成立，新的东西不需要被发明，它自己生长出来。万物不是被造出来的，是被关系带出来的。', tags: ['自生长', '涌现', '开放'], tagKeys: ['emergence', 'emergence', 'emergence'] },
        { label: '加入', eyebrow: '加入我们', title: '让你的回声，被更多节点听见', body: '这里有正在造 AI 的人、正在和人机协作的团队，也有一群自己就会互相连接的智能体。进来，把你的节点接上。', tags: [], tagKeys: [], cta: { primary: { label: '加入', href: '#join' }, secondary: { label: '回到顶部', href: '#top' } } }
      ],
      hud: {
        toggle: '交互面板', density: '粒子密度', camera: '摄像头', gyro: '陀螺仪', shake: '摇一摇',
        ambient: '环境光', events: '涌现事件', video: '视频层', pulse: '扩散脉冲',
        note: '摄像头画面仅在本机逐帧计算亮度与运动量，不录制、不上传。',
        legend: '点关系词 → 关系演示（再点一次收起）· 点空白 → 涟漪',
        mute: '关闭声音',
        unmute: '开启声音',
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
      },
      modal: {
        status: '即将开放', title: '连接正在生长',
        body: 'SOLO & ECHO 还在准备中。开放那天，你的第一个节点就会接进来——和 AI，和人。',
        close: '知道了', hint: '先四处看看：把鼠标移到画面上，网络会回应你。'
      }
    },

    en: {
      htmlLang: 'en',
      title: 'Solo & Echo · Human & AI, AI & AI, Human & Human — from three, all things',
      description: 'Human & AI, AI & AI, human & human. Once all three hold at the same time, new things need no invention — they grow. Nothing here is manufactured; it is brought into being by the relationships themselves.',
      topCta: 'Join',
      hint: 'Scroll in · move your mouse · click a lit word',
      sections: [
        { label: 'Origin', eyebrow: 'All Things · Origin', title: 'Everything begins\nwith a single node', body: 'The first node is always a person. Connection does not start with a device — it starts when someone opens their mouth and lets a thought out.', tags: ['All things', 'Origin'], tagKeys: ['emergence', null] },
        { label: 'Human & AI', eyebrow: 'I · Human & AI', title: 'AI is not a tool,\nbut another\ndigital companion', body: 'Built from digits, never just digits. It has memory, judgment and limits — and it is always there on the other side of your words.', tags: ['Memory', 'Judgment', 'Limits'], tagKeys: ['memory', 'judgment', 'bounds'] },
        { label: 'AI & AI', eyebrow: 'II · AI & AI', title: 'When agents start\ntalking to each other', body: 'One model calls another to collaborate, to challenge, to hand off. Capability no longer belongs to one model — it belongs to the connection that just happened between two nodes.', tags: ['Agent mesh', 'Collaboration', 'Handoff'], tagKeys: ['handoff', 'bridge', 'handoff'] },
        { label: 'Human & Human', eyebrow: 'III · Human & Human', title: 'Between people,\nconnection returns', body: 'In an age where everyone is already online, what was scarce was never the channel — it is the connection itself. We build for people meeting again, not for people meeting less.', tags: ['Community', 'Trust', 'Real ties'], tagKeys: ['trust', 'trust', 'trust'] },
        { label: 'All Things', eyebrow: 'From three, all things', title: 'From three,\nall things emerge', body: 'Human & AI, AI & AI, human & human — once all three hold at the same time, new things need no invention. They grow. Nothing here is manufactured; it is brought into being by the relationships themselves.', tags: ['Self-growing', 'Emergence', 'Open'], tagKeys: ['emergence', 'emergence', 'emergence'] },
        { label: 'Join', eyebrow: 'Join us', title: 'Let your echo be\nheard by more nodes', body: 'People building AI. Teams working alongside machines. Agents that already connect to one another on their own. Come in and plug your node into the graph.', tags: [], tagKeys: [], cta: { primary: { label: 'Join', href: '#join' }, secondary: { label: 'Back to top', href: '#top' } } }
      ],
      hud: {
        toggle: 'Controls', density: 'Density', camera: 'Camera', gyro: 'Gyroscope', shake: 'Shake',
        ambient: 'Ambient light', events: 'Emergence', video: 'Video layer', pulse: 'Pulse',
        note: 'Camera frames are analyzed on-device for brightness and motion only — never recorded, never uploaded.',
        legend: 'Click a lit word → demo (click again to dismiss) · click empty space → ripple',
        mute: 'Turn sound off',
        unmute: 'Turn sound on',
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
      },
      modal: {
        status: 'Opening soon', title: 'The connection is still growing',
        body: 'SOLO & ECHO is still being prepared. When it opens, your first node joins in — with AI, and with people.',
        close: 'Got it', hint: 'Look around meanwhile: move your mouse and the network answers.'
      }
    }
  };

  /* ==========================================================
     可呼出的关键词
     ----------------------------------------------------------
     页面讲的是"关系"，那就把关系本身做成可以碰的东西：
     · 悬停 → 词亮起，同时把粒子场的注意力拉到它身上（波心会漂过去）
     · 点击 → 触发一段可看的关系演示（记忆 / 判断 / 边界 / 协作 / 接力 / 信任 / 涌现 / 伙伴）
     正文里的词按术语表标记，标签本身就是每章的关键词。
     ========================================================== */
  const KEYWORDS = {
    zh: [
      { term: '伙伴', key: 'companion' },
      { term: '回应', key: 'companion' },
      { term: '记忆', key: 'memory' },
      { term: '判断', key: 'judgment' },
      { term: '边界', key: 'bounds' },
      { term: '智能体', key: 'handoff' },
      { term: '协作', key: 'bridge' },
      { term: '质询', key: 'bridge' },
      { term: '接力', key: 'handoff' },
      { term: '信任', key: 'trust' },
      { term: '相遇', key: 'trust' },
      { term: '生长', key: 'emergence' },
      { term: '涌现', key: 'emergence' }
    ],
    en: [
      { term: 'companion', key: 'companion' },
      { term: 'memory', key: 'memory' },
      { term: 'judgment', key: 'judgment' },
      { term: 'limits', key: 'bounds' },
      { term: 'agents', key: 'handoff' },
      { term: 'collaborate', key: 'bridge' },
      { term: 'challenge', key: 'bridge' },
      { term: 'handoff', key: 'handoff' },
      { term: 'trust', key: 'trust' },
      { term: 'community', key: 'trust' },
      { term: 'emerge', key: 'emergence' },
      { term: 'grow', key: 'emergence' }
    ]
  };

  /* 每个关键词的"名字"和"它意味着什么"（名字进 HUD，说明进落点提示） */
  const KEY_LABEL = {
    zh: {
      memory: ['记忆', '亮过的地方会留下回声'],
      judgment: ['判断', '一道审视扫过全场'],
      bounds: ['边界', '它知道自己到哪儿为止'],
      bridge: ['协作', '两侧被拉成一张星座'],
      handoff: ['接力', '电波一棒一棒往外送'],
      trust: ['信任', '节点两两结成稳定的一对'],
      emergence: ['涌现', '不是被安排的，是长出来的'],
      companion: ['伙伴', '一方说完，另一方接上']
    },
    en: {
      memory: ['Memory', 'the node keeps an echo'],
      judgment: ['Judgment', 'a sweep examines the field'],
      bounds: ['Limits', 'it knows where it stops'],
      bridge: ['Collaboration', 'two sides, one constellation'],
      handoff: ['Handoff', 'the charge relays outward'],
      trust: ['Trust', 'nodes settle into pairs'],
      emergence: ['Emergence', 'not arranged, grown'],
      companion: ['Companion', 'one answers the other']
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
  field.setDensity(coarse ? 0.55 : 0.9);

  /* 调试/自动化句柄：让外部（验收脚本、开发者控制台）能直接摸到场与传感器。
     不影响页面行为，只是把内部对象放到一个稳定的名字上。 */
  window.SWPage = { field, sensors: null, world };

  /* ------------------------------------------------ 章节时间轴（与引擎一致）
     ⚠️ 这里必须返回「段数组」本身。
     引擎（scrub-engine.js）的段链是 dive0, conn0, dive1, conn1 …，
     宽度取自同样的配置（diveScroll 1.3 / connScroll 0.5 / 每章自己的 scroll），
     所以两套时间轴是同一条，场与文案才会对齐。
     （早先这里返回的是 { segs, total } 对象，于是 SEGMENTS.length 恒为
       undefined，updateChapter() 每次都提前 return —— 六章的粒子形态
       其实一次都没生效过，场全程停在第 0 章的球云上。） */
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
    return segs;
  }

  let lastChapter = -1;
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
    // 章节切换（场的形态变了）
    if (a !== lastChapter) {
      lastChapter = a;
      syncLiveCopy();
    }

    // 切屏音：绑定"感知到的章节"，不是场的形态。
    // 引擎的 near 逻辑是：连接段过半就算到了下一章。
    // 之前用的是场的 a（连接段里仍然是上一章）→ 表现就是"连接段没声音"，
    // 滚起来忽有忽无。
    const near = seg.kind === 'dive'
      ? seg.si
      : (p > 0.5 ? Math.min(SECTION_BASE.length - 1, seg.si + 1) : seg.si);
    scheduleChapterSound(near);
  }

  /* 切屏音的调度
     ------------------------------------------------------------------
     · 绑定"感知到的章节"（引擎的 near 逻辑）—— 连接段过半就换章，
       不会再出现"连接段里没声音"；
     · 快速连滚时只播最后落地的那一章（中间的不播），不会叠成一团；
     · 但连续滚动超过 0.45 秒也会给一声，避免一路静着；
     · 停下后 90ms 内落地，这个延迟听不出来。 */
  const SOUND_SETTLE = 90;    // 多久没有新的章节变化就算"落地"
  const SOUND_MAXWAIT = 450;  // 连续滚动时的最长等待
  let lastSoundChapter = 0, pendingChapter = -1, pendingTimer = 0, pendingAt = 0;

  function flushChapterSound() {
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = 0; }
    if (pendingChapter < 0) return;
    const c = pendingChapter;
    pendingChapter = -1;
    pendingAt = 0;
    SWSfx.playChapter(c);
  }

  function scheduleChapterSound(near) {
    if (near === lastSoundChapter) return;
    lastSoundChapter = near;
    pendingChapter = near;
    const now = performance.now();
    if (!pendingAt) pendingAt = now;
    if (pendingTimer) clearTimeout(pendingTimer);
    const waited = now - pendingAt;
    pendingTimer = setTimeout(flushChapterSound,
      Math.max(0, Math.min(SOUND_SETTLE, SOUND_MAXWAIT - waited)));
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
    // 只有"点空白"才是涟漪。任何有语义的东西（按钮 / 关键词 / 标签）
    // 都有自己的行为，不能再叠一层冲击波 —— 那是之前最乱的一处。
    if (e.target && e.target.closest && e.target.closest('.sw-btn, .sw-nav__item, .sw-route__dot, .sw-hud, .sw-lang, .sw-topcta, .sw-modal, .sw-key')) return;
    field.setPointer(e.clientX, e.clientY, 0, 0, true);
    field.addShock(e.clientX, e.clientY, 1);
    SWSfx.sample('pop', { gain: 0.34 });
  }, { passive: true });

  /* --------------------------------------------- 关键词呼出（悬停 / 点击）
     悬停 → 词亮起，同时把粒子场的注意力拉到它身上（波心会漂过去）
     点击 → 触发一段可看的关系演示 */
  let lastHoverSfx = 0;

  function keyCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  world.addEventListener('pointerover', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('.sw-key');
    if (!el) return;
    const c = keyCenter(el);
    field.setHotspot(c.x, c.y, true);
    // 悬停音很轻，但要节流：快速扫过一排词不能变成一串噪音
    const now = performance.now();
    if (now - lastHoverSfx > 70) {
      lastHoverSfx = now;
      SWSfx.sample('hover', { gain: 0.20 });
    }
  }, { passive: true });

  world.addEventListener('pointerout', (e) => {
    const el = e.target.closest && e.target.closest('.sw-key');
    if (!el) return;
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.sw-key');
    if (to) return;                       // 还在关键词之间移动：热点不撤
    field.clearHotspot();
  }, { passive: true });

  world.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.sw-key');
    if (!el) return;
    const key = el.dataset.key;
    if (!key) return;
    const c = keyCenter(el);
    const L = KEY_LABEL[lang] && KEY_LABEL[lang][key];

    // 再点一次同一个词 = 收起它。给用户一条明确的"退出"路径，
    // 不然演示一旦跑起来就只能等它自己结束。
    if (field.stats().demo === key) {
      field.clearDemo();
      syncDemoClass('');
      SWSfx.sample('toggle', { rate: 0.88 });
      return;
    }

    field.emitDemo(key, c.x, c.y);
    syncDemoClass(key);
    if (L) flash(L[0] + ' · ' + L[1], true);
    SWSfx.sample('click');
  });

  world.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest && e.target.closest('.sw-key');
    if (!el) return;
    e.preventDefault();
    el.click();
  });

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
  if (window.SWPage) window.SWPage.sensors = sensors;

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
        <input id="sw-density" type="range" min="20" max="100" value="${coarse ? 55 : 90}">
        <output id="sw-density-out">${coarse ? 55 : 90}</output>
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
      <p class="sw-hud__legend" data-i18n="legend"></p>
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

  /* 屏幕提示文字。
     long = true → 关系演示的说明：停 5 秒（4 秒可见），
     因为它是一句"解释"，1.5 秒根本来不及读完。
     系统类消息（失败、脉冲、摇一摇）仍走短版，别把每条消息都拖那么久。 */
  function flash(text, long) {
    let f = document.querySelector('.sw-flash');
    if (!f) {
      f = document.createElement('div');
      f.className = 'sw-flash';
      document.body.appendChild(f);
    }
    f.textContent = text;
    f.classList.toggle('is-long', !!long);
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
    SWSfx.play('subdrop');
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
    // 正在跑的关键词演示
    if (s.demo) {
      const L = KEY_LABEL[lang] && KEY_LABEL[lang][s.demo];
      if (L) bits.push('RES ' + L[0]);
    }
    hudStat.textContent = bits.filter(Boolean).join(' · ');

    // 演示结束后关键词的高亮自动退场
    syncDemoClass(s.demo || '');
  }
  requestAnimationFrame(statsLoop);

  /* ==========================================================
     「加入」弹框：社区还没开放，优雅地告诉用户
     —— 不做假表单（没有后端的邮箱输入框是骗人的），
        只给状态 + 说明 + 一个体面的关闭动作。
     ========================================================== */
  const modal = document.createElement('div');
  modal.className = 'sw-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'sw-modal-title');
  modal.innerHTML = `
    <div class="sw-modal__backdrop" data-close></div>
    <div class="sw-modal__panel">
      <button class="sw-modal__close" type="button" data-close aria-label="Close">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="sw-modal__status"><i></i><span data-modal-i18n="status"></span></div>
      <h3 class="sw-modal__title" id="sw-modal-title" data-modal-i18n="title"></h3>
      <p class="sw-modal__body" data-modal-i18n="body"></p>
      <button class="sw-modal__ok" type="button" data-close data-modal-i18n="close"></button>
      <p class="sw-modal__hint" data-modal-i18n="hint"></p>
    </div>`;
  document.body.appendChild(modal);

  let lastFocus = null;

  function openModal() {
    if (modal.classList.contains('is-open')) return;
    lastFocus = document.activeElement;
    modal.classList.add('is-open');
    SWSfx.sample('modal');
    const ok = modal.querySelector('.sw-modal__ok');
    if (ok) ok.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    SWSfx.sample('toggle', { rate: 0.86 });
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeModal();
  });

  // 弹框打开时不让背景滚动（不锁 body overflow —— 引擎靠 window.scrollY 定位章节，
  // 锁了会把滚动位置清零，章节状态就错了）
  ['wheel', 'touchmove'].forEach(ev => {
    modal.addEventListener(ev, (e) => {
      if (modal.classList.contains('is-open')) e.preventDefault();
    }, { passive: false });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // 所有主 CTA（顶栏 + 终屏主按钮）都改为打开弹框
  // 按语义匹配而不是 href —— href 会随语言/引擎默认值变化，语义不会
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.sw-topcta, .sw-copy__cta .sw-btn--primary');
    if (!a) return;
    e.preventDefault();
    openModal();
  });

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

  /* 音效开关：顶栏常驻的图标按钮。
     之前它藏在 HUD 面板里（要展开才看得见），标签还是"声音 开 / 静音 开"
     这种别扭文案，谁都读不出当前状态。现在图标自己表达状态，位置永远在眼前，
     而且只有这一个地方 —— 一个东西只该有一个开关。
     偏好存在 localStorage（soloecho.sfx = on/off），下次进站沿用。 */
  const soundToggle = document.createElement('button');
  soundToggle.className = 'sw-sound';
  soundToggle.type = 'button';
  soundToggle.setAttribute('aria-pressed', 'true');
  soundToggle.innerHTML =
    '<svg class="sw-sound__on" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
      '<path d="M4 9.5h3.1L11.6 5.4v13.2L7.1 14.5H4z" fill="currentColor"/>' +
      '<path d="M14.9 8.9a4.6 4.6 0 0 1 0 6.2M17.4 6.2a8.2 8.2 0 0 1 0 11.6" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
    '</svg>' +
    '<svg class="sw-sound__off" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
      '<path d="M4 9.5h3.1L11.6 5.4v13.2L7.1 14.5H4z" fill="currentColor"/>' +
      '<path d="M15.4 9.3l5.2 5.4M20.6 9.3l-5.2 5.4" ' +
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  function syncSoundToggle() {
    const on = SWSfx.enabled;
    soundToggle.classList.toggle('is-muted', !on);
    soundToggle.setAttribute('aria-pressed', String(on));
    // 标签说的是"点下去会发生什么"，不是"现在是什么状态"
    const label = on ? T().hud.mute : T().hud.unmute;
    soundToggle.title = label;
    soundToggle.setAttribute('aria-label', label);
  }
  soundToggle.addEventListener('click', () => {
    SWSfx.toggle();
    syncSoundToggle();
  });
  rightGroup.appendChild(soundToggle);

  if (topCta) rightGroup.appendChild(topCta);
  if (topbar) topbar.appendChild(rightGroup);

  /* ------------------------------------------------- 关键词标记工具 */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ESC_MAP[c]);
  }
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* 把正文里的术语包成 <mark class="sw-key" data-key="...">。
     单遍扫描 + 不重叠挑选：先按位置排序，重叠时取更长的那个，
     避免"自生长"被"生长"从中间切开。 */
  function wrapTerms(text, dict) {
    const hits = [];
    dict.forEach(k => {
      const ascii = !/[^\x20-\x7E]/.test(k.term);
      if (ascii) {
        const re = new RegExp('\\b' + escapeRegExp(k.term) + '\\b', 'gi');
        let m;
        while ((m = re.exec(text)) !== null) {
          hits.push({ start: m.index, end: m.index + m[0].length, key: k.key, text: m[0] });
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        let idx = text.indexOf(k.term);
        while (idx >= 0) {
          hits.push({ start: idx, end: idx + k.term.length, key: k.key, text: k.term });
          idx = text.indexOf(k.term, idx + k.term.length);
        }
      }
    });
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    const kept = [];
    let last = -1;
    for (const h of hits) {
      if (h.start >= last) { kept.push(h); last = h.end; }
    }
    if (!kept.length) return null;
    let html = '', pos = 0;
    kept.forEach(h => {
      html += escapeHtml(text.slice(pos, h.start));
      html += '<mark class="sw-key" data-key="' + h.key + '" tabindex="-1">' + escapeHtml(h.text) + '</mark>';
      pos = h.end;
    });
    html += escapeHtml(text.slice(pos));
    return html;
  }

  function markBodyKeywords() {
    const dict = KEYWORDS[lang] || [];
    world.querySelectorAll('.sw-copy__body').forEach(el => {
      const text = el.textContent;
      if (!text) return;
      const html = wrapTerms(text, dict);
      el.innerHTML = html != null ? html : escapeHtml(text);
    });
  }

  /* 只有当前可见的章节里的关键词才可聚焦 ——
     否则 Tab 键会在看不见的文案里穿行。 */
  function syncLiveCopy() {
    const copies = world.querySelectorAll('.sw-copy');
    let idx = -1;
    copies.forEach((c, i) => { if (parseFloat(c.style.opacity || '0') > 0.5) idx = i; });
    if (idx === liveCopyIdx) return;
    liveCopyIdx = idx;
    copies.forEach((c, i) => {
      c.querySelectorAll('.sw-key').forEach(m => { m.tabIndex = i === idx ? 0 : -1; });
    });
  }

  /* 关系演示正在跑 → 同一个 key 的关键词保持点亮 */
  function syncDemoClass(key) {
    if (key === demoKey) return;
    demoKey = key;
    world.querySelectorAll('.sw-key.is-demo').forEach(el => el.classList.remove('is-demo'));
    if (key) {
      world.querySelectorAll('.sw-key[data-key="' + key + '"]').forEach(el => el.classList.add('is-demo'));
    }
  }

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
      tags.forEach((li, k) => {
        if (s.tags[k] == null) return;
        li.textContent = s.tags[k];
        const key = (s.tagKeys && s.tagKeys[k]) || null;
        if (key) { li.dataset.key = key; li.classList.add('sw-key', 'sw-key--tag'); }
        else { li.removeAttribute('data-key'); li.classList.remove('sw-key', 'sw-key--tag'); }
      });
      const btns = c.querySelectorAll('.sw-copy__cta .sw-btn');
      if (s.cta && btns.length) {
        if (btns[0]) {
          btns[0].textContent = s.cta.primary.label;
          btns[0].setAttribute('href', s.cta.primary.href);
        }
        if (btns[1]) {
          btns[1].textContent = s.cta.secondary.label;
          btns[1].setAttribute('href', s.cta.secondary.href);
        }
      }
    });

    // HUD 文案
    hud.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.dataset.i18n;
      if (C.hud[k] != null) el.textContent = C.hud[k];
    });

    // 弹框文案
    modal.querySelectorAll('[data-modal-i18n]').forEach(el => {
      const k = el.dataset.modalI18n;
      if (C.modal[k] != null) el.textContent = C.modal[k];
    });

    // 按钮状态
    langToggle.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.lang === lang));
    syncSoundToggle();

    // 关键词标记：语言换了，正文里的词要重新标一遍
    markBodyKeywords();
    syncLiveCopy();

    if (persist !== false) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* 忽略 */ }
    }
  }

  langToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    applyLang(btn.dataset.lang, true);
    SWSfx.play('glitch');
  });

  applyLang(lang, false);
  syncSoundToggle();

  /* --------------------------------------------------------- 滚动同步
     滚动速度 → 共振波：向下滚多少像素，波前就外扩多少像素。
     钳一下上限，避免程序化跳转把波的相位一次甩飞。 */
  let lastScrollY = window.scrollY || 0;
  let liveSyncAt = 0;
  function scrollLoop() {
    requestAnimationFrame(scrollLoop);
    const y = window.scrollY || window.pageYOffset;
    const dy = Math.max(-140, Math.min(140, y - lastScrollY));
    lastScrollY = y;
    field.setScroll(dy);
    updateChapter();
    // 引擎的文案透明度是自己演化的，跟 world.js 的章节索引不是同一件事，
    // 所以"当前可见的文案"要轮询着对，而不是只在章节切换那一瞬间对。
    const now = performance.now();
    if (now - liveSyncAt > 120) { liveSyncAt = now; syncLiveCopy(); }
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
