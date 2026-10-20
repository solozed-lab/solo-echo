/* ============================================================================
   field.js — 实时粒子网络场（scroll-world 的交互视觉层）
   ----------------------------------------------------------------------------
   一张由光点构成的网络：万物是节点，连接是光线。

   能力：
   · WebGL2 渲染：粒子 + 连线 + 扩散冲击波 + 指针轨迹（Canvas2D 自动降级）
   · 噪声流场驱动（不是随机抖动，而是有机的连续流动）
   · 指针交互：慢速推开 / 快速拉拽（速度自适应），点击发射冲击波
   · 章节形态插值：球云 / 双极 / 星团 / 球壳 / 拱门，随滚动平滑过渡
   · 涌现事件调度：链式传导 / 簇爆 / 涟漪 / 群聚 / 星座连线
   · 自适应画质：按帧耗时自动升降粒子密度
   · 外部信号：energy（亮度/运动）、warmth（色温）、gravity（陀螺仪倾斜）
   ========================================================================== */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- 随机 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 梯度噪声：用于流场，比白噪声更有机、更连续 */
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const SIZE = 256, MASK = 255;
    const perm = new Uint8Array(SIZE);
    for (let i = 0; i < SIZE; i++) perm[i] = i;
    for (let i = SIZE - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    const grad = new Float32Array(SIZE * 2);
    for (let i = 0; i < SIZE; i++) {
      const a = rnd() * TAU;
      grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a);
    }
    const hash = (x, y) => perm[(perm[x & MASK] + y) & MASK];
    const dot = (ix, iy, dx, dy) => {
      const h = hash(ix, iy) * 2;
      return grad[h] * dx + grad[h + 1] * dy;
    };
    return function (x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const n00 = dot(x0, y0, fx, fy);
      const n10 = dot(x0 + 1, y0, fx - 1, fy);
      const n01 = dot(x0, y0 + 1, fx, fy - 1);
      const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1);
      const a = n00 + (n10 - n00) * u;
      const b = n01 + (n11 - n01) * u;
      return a + (b - a) * v;
    };
  }

  /* ------------------------------------------------------------ 颜色工具 */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }
  const mixRgb = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];

  /* ---------------------------------------------------------------- 章节
     场（field）的章节参数。world.js 把滚动进度映射到这里的章节索引。
     shape 决定节点被"吸引"到的目标形态，kShape 决定吸引强度。 */
  const CHAPTERS = [
    { id: 'origin', shape: 'sphere',   rScale: 0.46, kShape: 0.40, flow: 1.00, speed: 1.00, link: 132, linkAlpha: 0.50, size: 2.5, energy: 0.55,
      pal: ['#4de3ff', '#7f9dff', '#a06bff'] },
    { id: 'ai',     shape: 'bipolar',  rScale: 0.40, kShape: 0.55, flow: 0.80, speed: 1.10, link: 146, linkAlpha: 0.55, size: 2.4, energy: 0.70,
      pal: ['#4de3ff', '#a06bff', '#ff7bd5'] },
    { id: 'human',  shape: 'cluster',  rScale: 0.42, kShape: 0.50, flow: 0.90, speed: 1.05, link: 118, linkAlpha: 0.62, size: 2.6, energy: 0.65,
      pal: ['#ffb765', '#ff8f6b', '#4de3ff'] },
    { id: 'mesh',   shape: 'shell',    rScale: 0.52, kShape: 0.45, flow: 0.50, speed: 0.85, link: 138, linkAlpha: 0.45, size: 2.3, energy: 0.45,
      pal: ['#4de3ff', '#a06bff', '#ffb765'] },
    { id: 'join',   shape: 'gate',     rScale: 0.40, kShape: 0.68, flow: 0.35, speed: 0.70, link: 112, linkAlpha: 0.60, size: 2.8, energy: 0.35,
      pal: ['#4de3ff', '#eaf6ff', '#ffb765'] }
  ];

  const KIND_World = 0, KIND_AI = 1, KIND_Human = 2, KIND_Core = 3;

  /* ============================================================== 渲染器 */
  const GLSL_PAL = `
    vec3 palette(float h, vec3 c1, vec3 c2, vec3 c3){
      h = clamp(h, 0.0, 1.0);
      vec3 c = mix(c1, c2, clamp(h * 2.0, 0.0, 1.0));
      return mix(c, c3, clamp(h * 2.0 - 1.0, 0.0, 1.0));
    }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('shader: ' + log);
    }
    return sh;
  }

  function makeProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  function WebGLRenderer(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, antialias: false, premultipliedAlpha: false,
      powerPreference: 'high-performance', depth: false, stencil: false
    });
    if (!gl) return null;
    this.gl = gl;

    const VS_POINT = `#version 300 es
      in vec2 aPos; in vec3 aAttr;
      uniform vec2 uRes; uniform float uDpr;
      out float vHue; out float vAlpha;
      void main(){
        vec2 p = (aPos / uRes) * 2.0 - 1.0;
        p.y = -p.y;
        gl_Position = vec4(p, 0.0, 1.0);
        gl_PointSize = max(3.0, aAttr.x * uDpr);
        vHue = aAttr.y; vAlpha = aAttr.z;
      }`;

    const VS_LINE = `#version 300 es
      in vec2 aPos; in vec2 aAttr;
      uniform vec2 uRes;
      out float vHue; out float vAlpha;
      void main(){
        vec2 p = (aPos / uRes) * 2.0 - 1.0;
        p.y = -p.y;
        gl_Position = vec4(p, 0.0, 1.0);
        vHue = aAttr.x; vAlpha = aAttr.y;
      }`;

    // 点精灵用径向衰减做柔和光晕；线用扁平着色（两者必须分开，
    // gl_PointCoord 在绘制线时无意义，会让整条线变黑）
    const FS_POINT = `#version 300 es
      precision mediump float;
      in float vHue; in float vAlpha;
      uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
      out vec4 outColor;
      ${GLSL_PAL}
      void main(){
        vec3 col = palette(vHue, uC1, uC2, uC3);
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.4);
        float w = clamp(vAlpha, 0.0, 1.0) * a;
        outColor = vec4(col * w, w);
      }`;

    const FS_LINE = `#version 300 es
      precision mediump float;
      in float vHue; in float vAlpha;
      uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
      out vec4 outColor;
      ${GLSL_PAL}
      void main(){
        vec3 col = palette(vHue, uC1, uC2, uC3);
        float w = clamp(vAlpha, 0.0, 1.0);
        outColor = vec4(col * w, w);
      }`;

    this.progPoint = makeProgram(gl, VS_POINT, FS_POINT);
    this.progLine = makeProgram(gl, VS_LINE, FS_LINE);

    const loc = (prog, name) => gl.getUniformLocation(prog, name);
    this.uPoint = {
      res: loc(this.progPoint, 'uRes'), dpr: loc(this.progPoint, 'uDpr'),
      c1: loc(this.progPoint, 'uC1'), c2: loc(this.progPoint, 'uC2'), c3: loc(this.progPoint, 'uC3')
    };
    this.uLine = {
      res: loc(this.progLine, 'uRes'),
      c1: loc(this.progLine, 'uC1'), c2: loc(this.progLine, 'uC2'), c3: loc(this.progLine, 'uC3')
    };

    // 点缓冲
    this.aPointLoc = {
      pos: gl.getAttribLocation(this.progPoint, 'aPos'),
      attr: gl.getAttribLocation(this.progPoint, 'aAttr')
    };
    this.bufPointPos = gl.createBuffer();
    this.bufPointAttr = gl.createBuffer();

    // 线缓冲
    this.aLineLoc = {
      pos: gl.getAttribLocation(this.progLine, 'aPos'),
      attr: gl.getAttribLocation(this.progLine, 'aAttr')
    };
    this.bufLine = gl.createBuffer();

    this.lineCapacity = 0;
    this.ok = true;
  }

  WebGLRenderer.prototype.resize = function (w, h) {
    const gl = this.gl;
    this.w = w; this.h = h;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);      // 预乘加色混合
  };

  WebGLRenderer.prototype.begin = function () {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  WebGLRenderer.prototype.setPalette = function (c1, c2, c3) {
    this._c1 = c1; this._c2 = c2; this._c3 = c3;
  };

  WebGLRenderer.prototype.drawLines = function (buf, count, dpr) {
    if (!count) return;
    const gl = this.gl;
    gl.useProgram(this.progLine);
    gl.uniform2f(this.uLine.res, this.w, this.h);
    gl.uniform3fv(this.uLine.c1, this._c1);
    gl.uniform3fv(this.uLine.c2, this._c2);
    gl.uniform3fv(this.uLine.c3, this._c3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLine);
    const need = count * 8;
    if (need > this.lineCapacity) {
      this.lineCapacity = Math.ceil(need * 1.5);
      gl.bufferData(gl.ARRAY_BUFFER, this.lineCapacity * 4, gl.DYNAMIC_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf, 0, need);
    const stride = 16;
    gl.enableVertexAttribArray(this.aLineLoc.pos);
    gl.vertexAttribPointer(this.aLineLoc.pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aLineLoc.attr);
    gl.vertexAttribPointer(this.aLineLoc.attr, 2, gl.FLOAT, false, stride, 8);
    gl.drawArrays(gl.LINES, 0, count * 2);
  };

  WebGLRenderer.prototype.drawPoints = function (posBuf, attrBuf, count, dpr) {
    if (!count) return;
    const gl = this.gl;
    gl.useProgram(this.progPoint);
    gl.uniform2f(this.uPoint.res, this.w, this.h);
    gl.uniform1f(this.uPoint.dpr, dpr);
    gl.uniform3fv(this.uPoint.c1, this._c1);
    gl.uniform3fv(this.uPoint.c2, this._c2);
    gl.uniform3fv(this.uPoint.c3, this._c3);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPointPos);
    gl.bufferData(gl.ARRAY_BUFFER, posBuf.subarray(0, count * 2), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPointLoc.pos);
    gl.vertexAttribPointer(this.aPointLoc.pos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPointAttr);
    gl.bufferData(gl.ARRAY_BUFFER, attrBuf.subarray(0, count * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPointLoc.attr);
    gl.vertexAttribPointer(this.aPointLoc.attr, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, count);
  };

  /* Canvas2D 降级：功能减半但绝不报错 */
  function Canvas2DRenderer(canvas) {
    this.ctx = canvas.getContext('2d');
    this.ok = !!this.ctx;
  }
  Canvas2DRenderer.prototype.resize = function (w, h) { this.w = w; this.h = h; };
  Canvas2DRenderer.prototype.begin = function () { this.ctx.clearRect(0, 0, this.w, this.h); };
  Canvas2DRenderer.prototype.setPalette = function (c1, c2, c3) {
    this._c = ['rgba(' + c1.map(v => Math.round(v * 255)).join(',') + ',',
                'rgba(' + c2.map(v => Math.round(v * 255)).join(',') + ',',
                'rgba(' + c3.map(v => Math.round(v * 255)).join(',') + ','];
  };
  Canvas2DRenderer.prototype.drawLines = function (buf, count) {
    const ctx = this.ctx;
    for (let i = 0; i < count; i++) {
      const o = i * 8;
      const hue = buf[o + 2], a = buf[o + 3];
      const ci = hue < 0.5 ? 0 : (hue < 1 ? 1 : 2);
      ctx.strokeStyle = this._c[ci] + (a * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(buf[o], buf[o + 1]);
      ctx.lineTo(buf[o + 4], buf[o + 5]);
      ctx.stroke();
    }
  };
  Canvas2DRenderer.prototype.drawPoints = function (posBuf, attrBuf, count) {
    const ctx = this.ctx;
    for (let i = 0; i < count; i++) {
      const x = posBuf[i * 2], y = posBuf[i * 2 + 1];
      const size = attrBuf[i * 3], hue = attrBuf[i * 3 + 1], a = attrBuf[i * 3 + 2];
      const ci = hue < 0.5 ? 0 : (hue < 1 ? 1 : 2);
      ctx.fillStyle = this._c[ci] + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, size * 1.6, 0, TAU);
      ctx.fill();
    }
  };

  /* ============================================================== 主对象 */
  function createField(canvas, opts) {
    opts = opts || {};
    const reduce = !!opts.reduce;
    const coarse = !!opts.coarse;

    const MAX = coarse ? 900 : 2400;
    const rnd = mulberry32(opts.seed || (Date.now() & 0xffffffff));
    const noise = makeNoise(opts.seed || 7);

    let W = 1, H = 1, DPR = 1;
    let renderer = new WebGLRenderer(canvas);
    const isGL = !!renderer && renderer.ok;
    if (!isGL) renderer = new Canvas2DRenderer(canvas);

    /* ---- 粒子状态 ---- */
    const px = new Float32Array(MAX), py = new Float32Array(MAX);
    const vx = new Float32Array(MAX), vy = new Float32Array(MAX);
    const pu = new Float32Array(MAX), pv = new Float32Array(MAX);
    const pkind = new Uint8Array(MAX), pcluster = new Uint8Array(MAX);
    const phue = new Float32Array(MAX), psize = new Float32Array(MAX);
    const pcharge = new Float32Array(MAX), pflash = new Float32Array(MAX);
    const swarmX = new Float32Array(MAX), swarmY = new Float32Array(MAX);
    const swarmT = new Float32Array(MAX);

    let count = Math.round(MAX * (coarse ? 0.55 : 0.72));
    let density = 1;           // 用户可调 0.25 - 1
    let quality = 1;          // 自适应画质 0.35 - 1

    for (let i = 0; i < MAX; i++) {
      pu[i] = rnd();
      pv[i] = rnd();
      pcluster[i] = (rnd() * 4) | 0;
      const r = rnd();
      pkind[i] = r < 0.58 ? KIND_World : r < 0.76 ? KIND_AI : r < 0.93 ? KIND_Human : KIND_Core;
      phue[i] = pkind[i] === KIND_AI ? 0.62 + rnd() * 0.3
              : pkind[i] === KIND_Human ? 0.02 + rnd() * 0.22
              : rnd() * 0.55;
      psize[i] = 0.7 + rnd() * 1.5 + (pkind[i] === KIND_Core ? 1.6 : 0);
      px[i] = rnd() * 1600; py[i] = rnd() * 900;
    }

    /* ---- 渲染缓冲 ---- */
    const posBuf = new Float32Array(MAX * 2);
    const attrBuf = new Float32Array(MAX * 3);
    const MAX_LINES = coarse ? 1800 : 5200;
    const lineBuf = new Float32Array(MAX_LINES * 8);

    /* ---- 空间网格（连线加速） ---- */
    let head = new Int32Array(0), next = new Int32Array(MAX);
    let gcols = 0, grows = 0;

    function ensureGrid(cols, rows) {
      if (cols !== gcols || rows !== grows) {
        gcols = cols; grows = rows;
        head = new Int32Array(cols * rows);
      }
      head.fill(-1);
    }

    /* ---- 状态 ---- */
    const state = {
      chapterA: 0, chapterB: 0, mix: 1,     // mix=1 表示已完全进入 B
      energy: 0, warmth: 0,
      pointer: { x: -9999, y: -9999, vx: 0, vy: 0, active: false, down: false },
      gravity: { x: 0, y: 0 },
      pointerRadius: 190,
      eventsOn: true,
      reduced: reduce
    };

    const shocks = [];       // {x,y,r,life,maxR,strength}
    const longLinks = [];    // {a,b,life}
    const clusters = [];     // 人与人章节的星团中心
    let t = 0, lastT = 0;
    let nextEventAt = 3.5, lastEvent = '';
    let eventCount = 0;
    let frameEMA = 16.7;
    let running = false, rafId = 0;
    let lastLineCount = 0;
    let pointerTrail = [];

    /* ---------------------------------------------------------- 形态目标 */
    function targetOf(ch, i, out, time) {
      const cx = W * 0.5, cy = H * 0.52;
      const rad = Math.min(W, H) * ch.rScale;
      const u = pu[i], v = pv[i], k = pkind[i];
      switch (ch.shape) {
        case 'sphere': {
          const a = u * TAU, rr = rad * (0.2 + 0.8 * Math.sqrt(v));
          out[0] = cx + Math.cos(a) * rr * 1.38;
          out[1] = cy + Math.sin(a) * rr * 0.74;
          break;
        }
        case 'bipolar': {
          const side = k === KIND_AI ? -1 : k === KIND_Human ? 1 : (v < 0.5 ? -1 : 1);
          const a = u * TAU, rr = rad * (0.08 + 0.42 * Math.sqrt(v));
          out[0] = cx + side * rad * 0.92 + Math.cos(a) * rr * 0.6;
          out[1] = cy + Math.sin(a) * rr * 0.95;
          break;
        }
        case 'cluster': {
          const c = clusters[pcluster[i] % Math.max(1, clusters.length)] || { x: cx, y: cy };
          const a = u * TAU, rr = rad * 0.38 * Math.sqrt(v);
          out[0] = c.x + Math.cos(a) * rr * 1.25;
          out[1] = c.y + Math.sin(a) * rr;
          break;
        }
        case 'shell': {
          const a = u * TAU, ph = Math.acos(2 * v - 1);
          out[0] = cx + Math.sin(ph) * Math.cos(a) * rad;
          out[1] = cy + Math.sin(ph) * Math.sin(a) * rad * 0.9;
          break;
        }
        case 'gate': {
          if (v < 0.62) {
            const th = Math.PI * u;
            out[0] = cx + Math.cos(th) * rad * 1.05;
            out[1] = cy - rad * 0.68 * Math.sin(th) + rad * 0.08;
          } else {
            const side = u < 0.5 ? -1 : 1;
            out[0] = cx + side * rad * 1.05;
            out[1] = cy + rad * 0.08 + v * rad * 0.9;
          }
          break;
        }
        default:
          out[0] = cx; out[1] = cy;
      }
    }

    function setClusters() {
      clusters.length = 0;
      const cx = W * 0.5, cy = H * 0.52, rad = Math.min(W, H) * 0.34;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.6;
        clusters.push({ x: cx + Math.cos(a) * rad * 0.95, y: cy + Math.sin(a) * rad * 0.62 });
      }
    }

    /* ---------------------------------------------------------- 参数插值 */
    const params = {
      kShape: 0, flow: 1, speed: 1, link: 130, linkAlpha: 0.5, size: 2.5, energy: 0.5,
      c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0]
    };
    const palCache = CHAPTERS.map(c => c.pal.map(hexToRgb));

    function updateParams() {
      const A = CHAPTERS[state.chapterA] || CHAPTERS[0];
      const B = CHAPTERS[state.chapterB] || A;
      const m = state.mix;
      params.kShape = A.kShape + (B.kShape - A.kShape) * m;
      params.flow = A.flow + (B.flow - A.flow) * m;
      params.speed = A.speed + (B.speed - A.speed) * m;
      params.link = A.link + (B.link - A.link) * m;
      params.linkAlpha = A.linkAlpha + (B.linkAlpha - A.linkAlpha) * m;
      params.size = A.size + (B.size - A.size) * m;
      params.energy = A.energy + (B.energy - A.energy) * m;
      const pa = palCache[state.chapterA], pb = palCache[state.chapterB];
      params.c1 = mixRgb(pa[0], pb[0], m);
      params.c2 = mixRgb(pa[1], pb[1], m);
      params.c3 = mixRgb(pa[2], pb[2], m);
    }

    /* ---------------------------------------------------------- 涌现事件 */
    const EVENT_POOL = ['chain', 'burst', 'swarm', 'constellation', 'ripple'];

    function pickEvent() {
      let pick = EVENT_POOL[(rnd() * EVENT_POOL.length) | 0];
      if (pick === lastEvent) {
        pick = EVENT_POOL[(EVENT_POOL.indexOf(pick) + 1 + ((rnd() * (EVENT_POOL.length - 1)) | 0)) % EVENT_POOL.length];
      }
      lastEvent = pick;
      return pick;
    }

    function fireEvent() {
      const type = pickEvent();
      eventCount++;
      const n = count;
      if (type === 'burst') {
        shocks.push({ x: rnd() * W, y: rnd() * H, r: 6, life: 1, maxR: Math.max(W, H) * 0.42, strength: 0.9 });
        for (let i = 0; i < n; i += 7) pflash[i] = 1;
      } else if (type === 'ripple') {
        shocks.push({ x: W * 0.5, y: H * 0.52, r: 10, life: 1, maxR: Math.max(W, H) * 0.8, strength: 0.35 });
      } else if (type === 'swarm') {
        const cx = rnd() * W, cy = rnd() * H;
        const picked = [];
        for (let i = 0; i < n; i += 1) if (rnd() < 0.06) picked.push(i);
        picked.forEach(i => {
          swarmX[i] = cx + (rnd() - 0.5) * 220;
          swarmY[i] = cy + (rnd() - 0.5) * 160;
          swarmT[i] = 2.6;
          pcharge[i] = 1;
        });
      } else if (type === 'constellation') {
        const picks = [];
        for (let i = 0; i < 5; i++) picks.push((rnd() * n) | 0);
        for (let i = 0; i < picks.length; i++) {
          for (let j = i + 1; j < picks.length; j++) {
            longLinks.push({ a: picks[i], b: picks[j], life: 1 });
          }
          pcharge[picks[i]] = 1;
        }
      } else if (type === 'chain') {
        // 沿邻近关系传播一次电荷链
        const start = (rnd() * n) | 0;
        const seen = new Set([start]);
        let frontier = [start];
        pcharge[start] = 1;
        for (let depth = 0; depth < 3 && frontier.length; depth++) {
          const nextF = [];
          for (const i of frontier) {
            for (let j = 0; j < n; j += 1) {
              if (seen.has(j)) continue;
              const dx = px[i] - px[j], dy = py[i] - py[j];
              if (dx * dx + dy * dy < params.link * params.link * 2.2) {
                seen.add(j); nextF.push(j); pcharge[j] = 1;
                if (nextF.length > 26) break;
              }
            }
          }
          frontier = nextF;
        }
      }
    }

    /* ---------------------------------------------------------- 主循环 */
    const tgtA = [0, 0], tgtB = [0, 0];

    function simulate(dt) {
      const f = Math.min(dt * 60, 2.5);
      const A = CHAPTERS[state.chapterA] || CHAPTERS[0];
      const B = CHAPTERS[state.chapterB] || A;
      const energy = Math.max(0, Math.min(1, state.energy));
      const warmth = state.warmth;
      const speedMul = params.speed * (0.65 + energy * 0.75);
      const damp = Math.pow(0.945, f);
      const maxV = 6.2 * speedMul;
      const pointer = state.pointer;
      const pSpeed = Math.hypot(pointer.vx, pointer.vy);
      const pull = Math.max(0, Math.min(1, (pSpeed - 1.6) / 12));   // 慢=推 快=拉
      const pr = state.pointerRadius;
      const gx = state.gravity.x * 0.9, gy = state.gravity.y * 0.9;
      const flowT = t * 0.055;

      for (let i = 0; i < count; i++) {
        targetOf(A, i, tgtA, t);
        targetOf(B, i, tgtB, t);
        const m = state.mix;
        let tx = tgtA[0] + (tgtB[0] - tgtA[0]) * m;
        let ty = tgtA[1] + (tgtB[1] - tgtA[1]) * m;

        // 群聚事件覆盖目标
        if (swarmT[i] > 0) {
          swarmT[i] -= dt;
          tx = tx * 0.35 + swarmX[i] * 0.65;
          ty = ty * 0.35 + swarmY[i] * 0.65;
        }

        let ax = (tx - px[i]) * params.kShape * 0.0016;
        let ay = (ty - py[i]) * params.kShape * 0.0016;

        // 噪声流场
        const n1 = noise(px[i] * 0.0017 + flowT, py[i] * 0.0017 - flowT * 0.7);
        const n2 = noise(px[i] * 0.0017 + 41.3 - flowT * 0.5, py[i] * 0.0017 + 17.9 + flowT);
        const fk = params.flow * (0.9 + energy * 0.5);
        ax += n1 * 0.055 * fk;
        ay += n2 * 0.055 * fk;

        // 陀螺仪重力
        ax += gx;
        ay += gy;

        // 指针交互
        if (pointer.active) {
          const dx = px[i] - pointer.x, dy = py[i] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < pr * pr && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const fall = 1 - d / pr;
            const dirx = dx / d, diry = dy / d;
            const push = (1 - pull) * fall * 0.9 - pull * fall * 0.55;
            ax += dirx * push * 0.5;
            ay += diry * push * 0.5;
            // 旋涡分量：让节点绕指针转，而不是单纯直线飞走
            ax += (-diry) * fall * 0.22 * (0.4 + pull);
            ay += (dirx) * fall * 0.22 * (0.4 + pull);
            pflash[i] = Math.max(pflash[i], fall * 0.8);
          }
        }

        // 冲击波
        for (let s = 0; s < shocks.length; s++) {
          const sh = shocks[s];
          const dx = px[i] - sh.x, dy = py[i] - sh.y;
          const d = Math.hypot(dx, dy);
          const band = Math.abs(d - sh.r);
          if (band < 70) {
            const k = (1 - band / 70) * sh.strength * 0.5;
            if (d > 0.01) { ax += (dx / d) * k * 0.25; ay += (dy / d) * k * 0.25; }
          }
        }

        vx[i] = (vx[i] + ax * f) * damp;
        vy[i] = (vy[i] + ay * f) * damp;

        const sp = Math.hypot(vx[i], vy[i]);
        if (sp > maxV) { const s = maxV / sp; vx[i] *= s; vy[i] *= s; }

        px[i] += vx[i] * f;
        py[i] += vy[i] * f;

        // 轻微回拉，避免粒子飘出画面后失联
        const margin = 120;
        if (px[i] < -margin) { px[i] = -margin; vx[i] *= -0.4; }
        if (px[i] > W + margin) { px[i] = W + margin; vx[i] *= -0.4; }
        if (py[i] < -margin) { py[i] = -margin; vy[i] *= -0.4; }
        if (py[i] > H + margin) { py[i] = H + margin; vy[i] *= -0.4; }

        pcharge[i] = Math.max(0, pcharge[i] - dt * 0.55);
        pflash[i] = Math.max(0, pflash[i] - dt * 2.2);
      }

      // 冲击波推进：用真实时间推进，约 3 秒掠过全屏，人才看得清"扩散"
      for (let s = shocks.length - 1; s >= 0; s--) {
        const sh = shocks[s];
        sh.r += (sh.maxR / 3.2) * dt;
        sh.life -= dt * 0.32;
        if (sh.life <= 0 || sh.r > sh.maxR) shocks.splice(s, 1);
      }
      for (let l = longLinks.length - 1; l >= 0; l--) {
        longLinks[l].life -= dt * 0.4;
        if (longLinks[l].life <= 0) longLinks.splice(l, 1);
      }
    }

    function buildLines() {
      const link = params.link * (0.82 + state.energy * 0.4);
      const cell = Math.max(40, link);
      const cols = Math.max(1, Math.ceil(W / cell) + 1);
      const rows = Math.max(1, Math.ceil(H / cell) + 1);
      ensureGrid(cols, rows);
      for (let i = 0; i < count; i++) {
        const cx = Math.min(cols - 1, Math.max(0, (px[i] / cell) | 0));
        const cy = Math.min(rows - 1, Math.max(0, (py[i] / cell) | 0));
        const idx = cy * cols + cx;
        next[i] = head[idx];
        head[idx] = i;
      }
      let ln = 0;
      const link2 = link * link;
      const maxLines = MAX_LINES;
      for (let i = 0; i < count && ln < maxLines; i++) {
        const cx = Math.min(cols - 1, Math.max(0, (px[i] / cell) | 0));
        const cy = Math.min(rows - 1, Math.max(0, (py[i] / cell) | 0));
        for (let oy = 0; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (oy === 0 && ox < 0) continue;
            if (oy === 1 && ox === 1) continue;   // 避免重复配对
            const nx = cx + ox, ny = cy + oy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            let j = head[ny * cols + nx];
            while (j !== -1 && ln < maxLines) {
              if (j > i) {
                const dx = px[i] - px[j], dy = py[i] - py[j];
                const d2 = dx * dx + dy * dy;
                if (d2 < link2) {
                  const d = Math.sqrt(d2);
                  let a = (1 - d / link) * params.linkAlpha;
                  a *= 0.45 + 0.55 * Math.max(pcharge[i], pcharge[j]);
                  a *= 0.8 + state.energy * 0.5;
                  const o = ln * 8;
                  lineBuf[o] = px[i]; lineBuf[o + 1] = py[i];
                  lineBuf[o + 2] = phue[i]; lineBuf[o + 3] = a;
                  lineBuf[o + 4] = px[j]; lineBuf[o + 5] = py[j];
                  lineBuf[o + 6] = phue[j]; lineBuf[o + 7] = a;
                  ln++;
                }
              }
              j = next[j];
            }
          }
        }
      }
      // 长程星座连线
      for (const l of longLinks) {
        if (ln >= maxLines) break;
        const o = ln * 8;
        const a = l.life * 0.5;
        lineBuf[o] = px[l.a]; lineBuf[o + 1] = py[l.a];
        lineBuf[o + 2] = phue[l.a]; lineBuf[o + 3] = a;
        lineBuf[o + 4] = px[l.b]; lineBuf[o + 5] = py[l.b];
        lineBuf[o + 6] = phue[l.b]; lineBuf[o + 7] = a;
        ln++;
      }
      return ln;
    }

    function buildShockRings() {
      let ln = 0;
      for (const sh of shocks) {
        const segs = 56;
        const alpha = Math.max(0, sh.life) * 0.42;
        for (let s = 0; s < segs; s++) {
          if (ln >= MAX_LINES) break;
          const a0 = (s / segs) * TAU, a1 = ((s + 1) / segs) * TAU;
          const o = ln * 8;
          lineBuf[o] = sh.x + Math.cos(a0) * sh.r; lineBuf[o + 1] = sh.y + Math.sin(a0) * sh.r;
          lineBuf[o + 2] = 0.55; lineBuf[o + 3] = alpha;
          lineBuf[o + 4] = sh.x + Math.cos(a1) * sh.r; lineBuf[o + 5] = sh.y + Math.sin(a1) * sh.r;
          lineBuf[o + 6] = 0.55; lineBuf[o + 7] = alpha;
          ln++;
        }
      }
      // 指针轨迹
      if (pointerTrail.length > 2) {
        for (let i = 1; i < pointerTrail.length; i++) {
          if (ln >= MAX_LINES) break;
          const a = pointerTrail[i - 1], b = pointerTrail[i];
          const o = ln * 8;
          lineBuf[o] = a.x; lineBuf[o + 1] = a.y; lineBuf[o + 2] = 0.45; lineBuf[o + 3] = 0.20 * a.life;
          lineBuf[o + 4] = b.x; lineBuf[o + 5] = b.y; lineBuf[o + 6] = 0.45; lineBuf[o + 7] = 0.20 * b.life;
          ln++;
        }
      }
      return ln;
    }

    function writeAttributes() {
      const sizeMul = params.size * (0.85 + state.energy * 0.35);
      for (let i = 0; i < count; i++) {
        posBuf[i * 2] = px[i];
        posBuf[i * 2 + 1] = py[i];
        const charge = pcharge[i];
        const flash = pflash[i];
        let hue = phue[i];
        if (state.warmth) hue = Math.max(0, Math.min(1, hue + state.warmth * 0.22));
        attrBuf[i * 3] = (psize[i] * sizeMul) * (1 + charge * 0.7 + flash * 0.5);
        attrBuf[i * 3 + 1] = hue;
        attrBuf[i * 3 + 2] = (0.30 + charge * 0.6 + flash * 0.45) * (0.75 + state.energy * 0.35);
      }
    }

    /* ------------------------------------------------------ 帧调度 */
    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (!lastT) lastT = now;
      let dt = (now - lastT) / 1000;
      lastT = now;
      if (dt > 0.1) dt = 0.1;
      frameEMA = frameEMA * 0.9 + (dt * 1000) * 0.1;
      t += dt;

      // 自适应画质
      if (frameEMA > 26 && quality > 0.35) quality = Math.max(0.35, quality - 0.02);
      else if (frameEMA < 15 && quality < 1) quality = Math.min(1, quality + 0.006);

      // 涌现事件调度（智能随机：有节奏、避免重复、按章节能量调整频率）
      if (state.eventsOn && !reduce) {
        if (t > nextEventAt) {
          fireEvent();
          const base = 5.5 + rnd() * 6.5 - params.energy * 2.2;
          nextEventAt = t + Math.max(2.2, base);
        }
      }

      simulate(dt);
      updateParams();
      renderer.setPalette(params.c1, params.c2, params.c3);
      renderer.begin();

      const lineCount = buildLines();
      renderer.drawLines(lineBuf, lineCount, DPR);
      const ringCount = buildShockRings();
      if (ringCount) renderer.drawLines(lineBuf.subarray(lineCount * 8), ringCount, DPR);
      lastLineCount = lineCount + ringCount;

      writeAttributes();
      renderer.drawPoints(posBuf, attrBuf, count, DPR);

      // 指针轨迹衰减
      for (const p of pointerTrail) p.life -= dt * 1.8;
      while (pointerTrail.length && pointerTrail[0].life <= 0) pointerTrail.shift();
    }

    /* ------------------------------------------------------ 公开接口 */
    function resize(w, h, dpr) {
      W = Math.max(1, w); H = Math.max(1, h); DPR = dpr;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      renderer.resize(W, H);
      setClusters();
    }

    function setDensity(d) {
      density = Math.max(0.2, Math.min(1, d));
      applyCount();
    }

    function applyCount() {
      const target = Math.max(60, Math.round(MAX * density * quality));
      count = Math.min(MAX, target);
    }

    const api = {
      canvas,
      isWebGL: isGL,
      chapterCount: CHAPTERS.length,
      chapters: CHAPTERS,

      resize,
      setDensity,

      /* 章节插值：a → b，mix 0..1 */
      setChapter(a, b, mix) {
        state.chapterA = a; state.chapterB = b;
        state.mix = Math.max(0, Math.min(1, mix));
      },

      /* 外部信号 */
      setEnergy(e) { state.energy = Math.max(0, Math.min(1.5, e || 0)); },
      setWarmth(w) { state.warmth = Math.max(-1, Math.min(1, w || 0)); },
      setGravity(x, y) { state.gravity.x = x; state.gravity.y = y; },
      setEvents(on) { state.eventsOn = !!on; },

      setPointer(x, y, vx, vy, active) {
        const p = state.pointer;
        const first = !p.active;
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.active = !!active;
        if (active && !reduce) {
          if (first || !pointerTrail.length ||
              Math.hypot(x - pointerTrail[pointerTrail.length - 1].x,
                         y - pointerTrail[pointerTrail.length - 1].y) > 6) {
            pointerTrail.push({ x, y, life: 1 });
            if (pointerTrail.length > 26) pointerTrail.shift();
          }
        }
      },

      /* 扩散冲击波 */
      addShock(x, y, strength) {
        shocks.push({
          x, y, r: 8, life: 1,
          maxR: Math.max(W, H) * (0.32 + strength * 0.4),
          strength: strength
        });
      },

      start() {
        if (running) return;
        running = true;
        lastT = 0;
        rafId = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        cancelAnimationFrame(rafId);
      },
      get running() { return running; },

      /* 静态一帧（reduced-motion 用） */
      renderStatic() {
        t = 0.0001;
        updateParams();
        renderer.setPalette(params.c1, params.c2, params.c3);
        renderer.begin();
        for (let i = 0; i < count; i++) {
          targetOf(CHAPTERS[state.chapterA], i, tgtA, t);
          px[i] = tgtA[0]; py[i] = tgtA[1];
        }
        const ln = buildLines();
        renderer.drawLines(lineBuf, ln, DPR);
        writeAttributes();
        renderer.drawPoints(posBuf, attrBuf, count, DPR);
      },

      stats() {
        return {
          particles: count,
          fps: Math.round(1000 / Math.max(1, frameEMA)),
          lines: lastLineCount,
          events: eventCount
        };
      }
    };

    applyCount();
    return api;
  }

  global.SWField = { create: createField, CHAPTERS };
})(window);
