// <building-flight> — scroll-driven camera flight through the Wohnkomplex.
// Light-DOM custom element: its first child [data-flight-canvas] receives the
// WebGL canvas (sticky, no flow space); its [data-stage="i"] children are the
// copy panels, faded in around their own keyframe.
(function () {
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  // pos + target keyframes, one per stage (see data-stage indices in the page)
  const KEYS = [
    { p: [-62, 34, 76], t: [0, 12, 0] },     // 0 exterior, blueprint
    { p: [-48, 19, 31], t: [-14, 10.5, 2] }, // 1 Das Modell — approach
    { p: [-40, 12.6, 4.2], t: [-16, 11.7, 0.6] }, // 2 Ablauf — toward the corridor mouth
    { p: [-22, 11.9, 0.2], t: [-4, 11.7, 0.1] }, // 3 Ertrag — inside the corridor
    { p: [-8, 12.1, 0.1], t: [11, 11.8, 0.2] }, // 4 Leistungen — crossing the atrium
    { p: [2.0, 12.8, 1.4], t: [0.0, 21.2, -1.0] }, // 5 Vertrauen — up through the core
    { p: [9, 28.5, 19], t: [-4, 20.6, -1.5] },  // 6 Kontakt — above the roof
  ];

  class BuildingFlight extends HTMLElement {
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      this._boot().catch((e) => console.error('building-flight', (e && e.stack) || String(e)));
    }
    disconnectedCallback() {
      this._stop = true;
      if (this._ro) this._ro.disconnect();
      if (this._renderer) this._renderer.dispose();
    }

    async _boot() {
      const host = this.querySelector('[data-flight-canvas]');
      if (!host) return;
      const base = new URL('.', document.baseURI).href;
      const [THREE, mod] = await Promise.all([
        import(THREE_URL),
        import(new URL('building-model.js', base).href),
      ]);

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      const cv = renderer.domElement;
      cv.style.cssText = 'display:block;width:100%;height:100%';
      host.appendChild(cv);
      this._renderer = renderer;

      const scene = new THREE.Scene();
      const bg = new THREE.Color(0x0e1014);
      scene.background = bg;
      scene.fog = new THREE.Fog(0x0e1014, 40, 190);

      const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

      scene.add(new THREE.HemisphereLight(0xa9bcd8, 0x161a20, 0.62));
      const key = new THREE.DirectionalLight(0xfff2dd, 2.1);
      key.position.set(38, 46, 30);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const sc = key.shadow.camera;
      sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 5; sc.far = 200;
      key.shadow.bias = -0.0012;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x8fa8cf, 0.7);
      fill.position.set(-40, 18, -34);
      scene.add(fill);

      const { group, wire, materials, lineMat, gridMat } = mod.buildComplex(THREE);
      scene.add(group, wire);

      // warm interior lights along the flight path
      const amb = new THREE.AmbientLight(0xbfd0e8, 0);
      scene.add(amb);
      const lamps = [[-22, 12.1, 0], [-16, 12.1, 0], [-10, 12.1, 0], [-4, 12.4, 0], [0, 12.6, 0], [6, 12.1, 0], [13, 12.1, 0], [20, 12.1, 0], [0, 5.5, 0], [0, 18.5, 0], [0, 21.5, 0]]
        .map(([x, y, z]) => {
          const l = new THREE.PointLight(0xffd9a4, 12, 30, 1.7);
          l.position.set(x, y, z);
          scene.add(l);
          return l;
        });

      const baseOp = materials.map((m) => m.opacity);
      const curvePos = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.p)), false, 'catmullrom', 0.35);
      const curveTgt = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.t)), false, 'catmullrom', 0.35);
      const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
      const skyCol = new THREE.Color(0x24304a), nightCol = new THREE.Color(0x0e1014);

      const stages = Array.from(this.querySelectorAll('[data-stage]'));
      const dots = Array.from(document.querySelectorAll('[data-rail-dot]'));
      const N = KEYS.length - 1;

      let shown = 0, target = 0;
      const readScroll = () => {
        const forced = this.getAttribute('data-p');
        if (forced !== null) { target = clamp(parseFloat(forced) || 0, 0, 1); return; }
        const r = this.getBoundingClientRect();
        const span = this.offsetHeight - innerHeight;
        target = clamp((-r.top) / Math.max(span, 1), 0, 1);
      };
      this._setP = (v) => { this.setAttribute('data-p', String(v)); readScroll(); };
      addEventListener('scroll', readScroll, { passive: true });
      readScroll();
      shown = target;

      const resize = () => {
        const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      this._ro = new ResizeObserver(resize);
      this._ro.observe(host);

      const apply = (p) => {
        curvePos.getPoint(p, pos);
        curveTgt.getPoint(p, tgt);
        // gentle drift so a parked scroll position still breathes
        const t = performance.now() / 1000;
        camera.position.set(pos.x + Math.sin(t * 0.24) * 0.16, pos.y + Math.sin(t * 0.19) * 0.12, pos.z + Math.cos(t * 0.21) * 0.16);
        camera.lookAt(tgt);

        const solid = smooth(0.05, 0.24, p);
        materials.forEach((m, i) => { m.opacity = baseOp[i] * solid; m.visible = solid > 0.02; });
        const bp = 1 - smooth(0.10, 0.30, p);
        lineMat.opacity = 0.6 * bp;
        lineMat.visible = bp > 0.01;
        gridMat.opacity = 0.32 * bp;
        wire.visible = bp > 0.01;

        const sky = smooth(0.80, 1.0, p);
        bg.copy(nightCol).lerp(skyCol, sky);
        scene.fog.color.copy(bg);
        scene.fog.near = 40 - 34 * smooth(0.2, 0.6, p);
        scene.fog.far = 190 - 40 * smooth(0.2, 0.7, p);
        renderer.toneMappingExposure = 1.0 + 0.18 * sky;
        const inside = smooth(0.28, 0.42, p) * (1 - smooth(0.72, 0.9, p));
        lamps.forEach((l) => { l.intensity = 2 + 8 * inside; });
        amb.intensity = 0.1 + 0.22 * inside;

        const local = p * N;
        stages.forEach((el, i) => {
          const d = Math.abs(local - i);
          const op = clamp(1 - d * 1.55, 0, 1);
          el.style.opacity = op.toFixed(3);
          el.style.transform = 'translateY(' + ((local - i) * -26).toFixed(1) + 'px)';
          el.style.pointerEvents = op > 0.45 ? 'auto' : 'none';
        });

        const active = Math.round(local);
        dots.forEach((el, i) => {
          el.style.color = i === active ? '#C79A52' : '#767D87';
          el.style.opacity = i === active ? '1' : '0.55';
        });
      };

      this._dbg = { camera, scene, renderer, group, wire, materials, lineMat, apply: () => shown };
      const tick = () => {
        if (this._stop) return;
        requestAnimationFrame(tick);
        shown += (target - shown) * 0.09;
        if (Math.abs(target - shown) < 0.00005) shown = target;
        apply(shown);
        renderer.render(scene, camera);
      };
      tick();
      this.setAttribute('data-ready', '');
    }
  }

  if (!customElements.get('building-flight')) customElements.define('building-flight', BuildingFlight);
})();
