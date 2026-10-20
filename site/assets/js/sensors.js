/* ============================================================================
   sensors.js — 可选传感器交互层
   ----------------------------------------------------------------------------
   · 摄像头   ：本机逐帧计算亮度 / 运动量 / 色温 → 驱动粒子"能量"与色温。
                画面只在本机内存里处理，不录制、不上传、不离开浏览器。
   · 陀螺仪   ：设备倾斜 → 重力向量 → 整个粒子场偏移（手机体验极佳）
   · 加速度计 ：摇一摇 → 触发扩散冲击波
   · 环境光   ：AmbientLightSensor → 整体曝光（设备稀少，不支持则隐藏入口）
   所有能力都做特性检测，不支持的入口直接不显示，绝不报错。
   ========================================================================== */
(function (global) {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function createSensors(field, opts) {
    opts = opts || {};
    const onState = opts.onState || function () {};
    const onShake = opts.onShake || function () {};

    const state = {
      energy: 0, warmth: 0, gx: 0, gy: 0,
      camera: false, orientation: false, motion: false, ambient: false,
      lum: 0, motionLevel: 0
    };

    /* ---------------------------------------------------------- 摄像头 */
    const camera = {
      supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      active: false,
      stream: null,
      video: null,
      preview: null,
      error: null,

      async enable() {
        if (this.active) return true;
        if (!this.supported) { this.error = '当前浏览器不支持摄像头访问'; return false; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 160 }, height: { ideal: 120 }, facingMode: 'user' },
            audio: false
          });
          this.stream = stream;
          const v = document.createElement('video');
          v.srcObject = stream;
          v.muted = true; v.playsInline = true; v.setAttribute('playsinline', '');
          await v.play();
          this.video = v;

          const c = document.createElement('canvas');
          c.width = 32; c.height = 24;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          this.preview = c;
          let prev = null;

          const tick = () => {
            if (!this.active) return;
            try {
              ctx.drawImage(v, 0, 0, 32, 24);
              const data = ctx.getImageData(0, 0, 32, 24).data;
              let lum = 0, r = 0, b = 0, diff = 0;
              for (let i = 0; i < data.length; i += 4) {
                const R = data[i], G = data[i + 1], B = data[i + 2];
                lum += (R * 0.299 + G * 0.587 + B * 0.114);
                r += R; b += B;
                if (prev) diff += Math.abs(R - prev[i]) + Math.abs(G - prev[i + 1]) + Math.abs(B - prev[i + 2]);
              }
              const px = data.length / 4;
              lum /= px; r /= px; b /= px;
              const motionLevel = prev ? clamp(diff / px / 60, 0, 1) : 0;
              prev = data.slice();

              state.lum = lum;
              state.motionLevel = motionLevel;
              // 运动越剧烈 → 粒子能量越高；画面越暖 → 色温越暖
              state.energy = clamp(motionLevel * 2.1, 0, 1.15);
              state.warmth = clamp((r - b) / 90, -1, 1);

              field.setEnergy(state.energy);
              field.setWarmth(state.warmth);
              onState(state);
            } catch (e) {
              this.error = '摄像头帧读取失败';
            }
            this._timer = setTimeout(tick, 110);
          };
          this.active = true;
          state.camera = true;
          tick();
          return true;
        } catch (e) {
          this.error = (e && e.name === 'NotAllowedError')
            ? '摄像头权限被拒绝'
            : (e && e.name === 'NotFoundError' ? '没有找到摄像头设备' : '摄像头启动失败');
          this.active = false;
          return false;
        }
      },

      disable() {
        this.active = false;
        state.camera = false;
        state.energy = 0;
        state.warmth = 0;
        field.setEnergy(0);
        field.setWarmth(0);
        clearTimeout(this._timer);
        if (this.stream) this.stream.getTracks().forEach(tr => tr.stop());
        this.stream = null;
        if (this.video) { this.video.srcObject = null; this.video = null; }
        this.preview = null;
        onState(state);
      },

      toggle() { return this.active ? (this.disable(), false) : this.enable(); }
    };

    /* ---------------------------------------------------------- 陀螺仪 */
    const orientation = {
      supported: ('DeviceOrientationEvent' in window),
      needsPermission: typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function',
      active: false,

      async enable() {
        if (this.active) return true;
        if (!this.supported) return false;
        if (this.needsPermission) {
          try {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res !== 'granted') return false;
          } catch (e) { return false; }
        }
        this._handler = (e) => {
          const beta = e.beta || 0;     // 前后倾斜
          const gamma = e.gamma || 0;   // 左右倾斜
          state.gx = clamp(gamma / 40, -1, 1) * 0.075;
          state.gy = clamp((beta - 45) / 40, -1, 1) * 0.065;
          field.setGravity(state.gx, state.gy);
          onState(state);
        };
        window.addEventListener('deviceorientation', this._handler, true);
        this.active = true;
        state.orientation = true;
        onState(state);
        return true;
      },

      disable() {
        if (this._handler) window.removeEventListener('deviceorientation', this._handler, true);
        this._handler = null;
        this.active = false;
        state.orientation = false;
        state.gx = state.gy = 0;
        field.setGravity(0, 0);
        onState(state);
      },

      toggle() { return this.active ? (this.disable(), false) : this.enable(); }
    };

    /* ------------------------------------------------------ 加速度 / 摇一摇 */
    const motion = {
      supported: 'DeviceMotionEvent' in window,
      active: false,
      _lastMag: 0,
      _cool: 0,

      enable() {
        if (this.active) return true;
        if (!this.supported) return false;
        this._handler = (e) => {
          const a = e.accelerationIncludingGravity || e.acceleration;
          if (!a) return;
          const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
          const delta = Math.abs(mag - this._lastMag);
          this._lastMag = mag;
          const now = performance.now();
          if (delta > 14 && now - this._cool > 700) {
            this._cool = now;
            onShake();
          }
        };
        window.addEventListener('devicemotion', this._handler);
        this.active = true;
        state.motion = true;
        onState(state);
        return true;
      },

      disable() {
        if (this._handler) window.removeEventListener('devicemotion', this._handler);
        this._handler = null;
        this.active = false;
        state.motion = false;
        onState(state);
      },

      toggle() { return this.active ? (this.disable(), false) : this.enable(); }
    };

    /* ---------------------------------------------------------- 环境光 */
    const ambient = {
      supported: 'AmbientLightSensor' in window,
      active: false,

      async enable() {
        if (this.active) return true;
        if (!this.supported) return false;
        try {
          if (typeof AmbientLightSensor.requestPermission === 'function') {
            const res = await AmbientLightSensor.requestPermission();
            if (res !== 'granted') return false;
          }
          this._sensor = new AmbientLightSensor({ frequency: 4 });
          this._handler = (e) => {
            const lux = e.illuminance || 0;
            const exposure = clamp(lux / 600, 0, 1);
            field.setEnergy(state.camera ? state.energy : exposure * 0.6);
            onState(state);
          };
          this._sensor.addEventListener('reading', this._handler);
          this._sensor.start();
          this.active = true;
          state.ambient = true;
          onState(state);
          return true;
        } catch (e) { return false; }
      },

      disable() {
        try { if (this._sensor) this._sensor.stop(); } catch (e) {}
        this._sensor = null;
        this.active = false;
        state.ambient = false;
        onState(state);
      },

      toggle() { return this.active ? (this.disable(), false) : this.enable(); }
    };

    return {
      state,
      camera, orientation, motion, ambient,
      disableAll() {
        camera.disable(); orientation.disable(); motion.disable(); ambient.disable();
      }
    };
  }

  global.SWSensors = { create: createSensors };
})(window);
