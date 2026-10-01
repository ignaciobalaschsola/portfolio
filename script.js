/* Ignacio Balasch Solá — portfolio behaviour. Three independent parts:
   1. scroll — one rAF-throttled scroll reader drives everything that is tied to scroll position:
               the turn (the poster pins for 140svh while he flips 1 → 4 → 3 → 5 → 6 → 1, a turntable flipbook),
               the name's letters drifting apart and back, words inking in as they cross the reading zone,
               and the desk heading assembling letter by letter
   2. desk   — the documents lie knolled on a 1440×1900 artboard; drag one and it springs home
   3. cue    — the scroll cue fades once the page has moved
   Test-only URL params: ?static=1 shows every final state, nothing pinned or moving;
   ?progress=0..1 scrolls to that point of the turn and holds the hero there (renders); ?pose=5|6|1|4|3 forces a pose. */
(() => {
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const STATIC = root.classList.contains('static');
  const PIN = root.classList.contains('pin');          // set in <head>: not static, not reduced motion
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------ 1. scroll */
  (function scroll() {
    const turn = document.getElementById('turn');
    const stage = turn && turn.querySelector('.stage');
    const me = document.getElementById('me');
    if (!turn || !stage || !me) return;

    /* --- the turn: a full rotation. 3 (right profile) → 5 (left profile) stands in for his back, so it gets
       a quick horizontal squash, like a coin on edge, and swaps at the thinnest point. Each entry: [from p, pose]. */
    const SEQ = [[0, '1'], [.14, '4'], [.30, '3'], [.50, '5'], [.66, '6'], [.84, '1']];
    const SPIN = .5, SPIN_W = .05, SQUASH = .45;           // around p=.5 he narrows to 55% and back
    const LABEL = { 5: 'in profile, facing left', 6: 'turned to the left, looking at the camera', 1: 'facing the camera',
                    4: 'turned to the right, looking at the camera', 3: 'in profile, facing right' };
    const imgs = {};
    me.querySelectorAll('img[data-pose]').forEach(im => { imgs[im.dataset.pose] = im; im.decode?.().catch(() => {}); });
    let pose = '1';
    const show = id => {
      if (id === pose || !imgs[id]) return;
      imgs[pose].classList.remove('on'); imgs[id].classList.add('on'); pose = id;
      me.setAttribute('aria-label', `Ignacio, in a blue T-shirt, ${LABEL[id]}`);
    };
    const forcedPose = q.get('pose');
    if (forcedPose && imgs[forcedPose]) show(forcedPose);
    if (!PIN) return;                                      // static or reduced motion: front pose, text as written

    const forcedP = q.has('progress') ? clamp(parseFloat(q.get('progress')) || 0) : null;
    if (forcedP !== null) history.scrollRestoration = 'manual';

    /* --- split text. Words stay plain inline spans (kerning and link underlines intact); only the one serif
       heading is split into inline-block characters, and it carries its text in aria-label. */
    const words = el => {
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 1) { words(n); continue; }
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/([ \t\n]+)/)) {   // only ordinary spaces split: &nbsp; pairs stay whole
          if (!part) continue;
          if (/^[ \t\n]+$/.test(part)) { frag.append(' '); continue; }
          const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.append(w);
        }
        n.replaceWith(frag);
      }
      el.classList.add('split');
      return [...el.querySelectorAll('.w')];
    };
    const chars = el => {
      el.setAttribute('aria-label', el.textContent);
      const walk = node => {
        for (const n of [...node.childNodes]) {
          if (n.nodeType === 1) { walk(n); continue; }
          if (n.nodeType !== 3) continue;
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            if (ch === ' ') { frag.append(' '); continue; }
            const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; c.setAttribute('aria-hidden', 'true');
            frag.append(c);
          }
          n.replaceWith(frag);
        }
      };
      walk(el); el.classList.add('split');
      return [...el.querySelectorAll('.c')];
    };

    const FLOOR = .22;                                     // unread words: faint but readable
    const say = document.querySelector('.say');
    const letters = [document.querySelectorAll('.name.back span'), document.querySelectorAll('.name.front span')];
    const nameEl = document.querySelector('.name.back');
    // per letter (I g n a c i o), in em at the height of the turn: sideways drift away from the gap he stands in
    // (the I and o barely move: both already touch the window edge), vertical drift, and how fast each lifts as the poster leaves
    const DX = [-.004, -.016, -.01, -.004, .006, .014, .008], DY = [-.05, -.03, -.02, -.035, -.04, -.025, -.055]   // all upward: nothing may sink below the poster's edge (the g's tail was clipped),
          LIFT = [0, .10, .04, .14, .06, .12, .02];

    const hero = { el: document.querySelector('.hero'), words: say ? words(say) : [], fs: 0 };
    const blocks = [...document.querySelectorAll('.fill')].filter(el => el !== say)
      .map(el => ({ el, words: words(el), lines: [], pinned: stage.contains(el) }));
    const builds = [...document.querySelectorAll('.build')].map(el => {
      const cs = chars(el);
      // a fixed, loose scatter: each character starts a little high (into the empty space above, never over the
      // line below), off-line and turned, then drops into place
      const scat = cs.map((_, i) => ({ x: ((i * 37) % 11 - 5) * .018, y: -(.14 + ((i * 53) % 7) * .045), r: ((i * 29) % 9 - 4) * 2.2 }));
      return { el, chars: cs, scat };
    });

    /* --- measure (on load, fonts, resize): nothing in the frame loop reads layout */
    let vh = 0, T = 0, top0 = 0, maxS = 0;
    const absorbed = s => clamp(s - top0, 0, T);           // scroll swallowed by the pin so far
    const viewY = (y, pinned, s) => y - s + (pinned ? absorbed(s) : 0);
    const zone = (y, pinned, a, b) => {                    // reading zone, clamped so the last lines still ink at max scroll
      const end = Math.max(b * vh, viewY(y, pinned, maxS) + 2);
      return [Math.max(a * vh, end + .22 * vh), end];
    };
    function measure() {
      vh = innerHeight;
      const s = scrollY;
      top0 = turn.getBoundingClientRect().top + s;
      T = turn.offsetHeight - stage.offsetHeight;
      maxS = Math.max(0, root.scrollHeight - vh);
      const stageTop = stage.getBoundingClientRect().top;
      const docY = (el, pinned) => pinned ? top0 + el.getBoundingClientRect().top - stageTop : el.getBoundingClientRect().top + s;
      hero.fs = parseFloat(getComputedStyle(nameEl).fontSize);
      for (const b of blocks) {
        const y0 = b.y = docY(b.el, b.pinned);
        const first = b.words[0]; if (!first) continue;
        // group words into lines by their offsetTop (transform-free), relative to the first word
        b.lines = []; let cur = null;
        for (const w of b.words) {
          const dy = w.offsetTop - first.offsetTop;
          if (!cur || Math.abs(dy - cur.dy) > 4) { cur = { dy, words: [] }; b.lines.push(cur); }
          cur.words.push(w);
        }
        for (const l of b.lines) [l.a, l.b] = zone(y0 + l.dy, b.pinned, .88, .5);
      }
      for (const b of builds) { b.y = docY(b.el, false); [b.a, b.b] = zone(b.y, false, .95, .6); }
    }

    /* --- per-frame writes, only when a value changes */
    const setO = (el, v) => { v = Math.round(v * 100) / 100; if (el._o !== v) { el._o = v; el.style.opacity = v; } };
    const setT = (el, prop, v) => { if (el['_' + prop] !== v) { el['_' + prop] = v; el.style[prop] = v; } };
    const ink = (ws, b, K) => {                            // b in [0,1] sweeps an ink front across the words, K words soft
      const n = ws.length;
      ws.forEach((w, i) => setO(w, FLOOR + (1 - FLOOR) * clamp((b * (n + K) - i) / K)));
    };

    function drawHero(s) {
      const p = forcedP ?? (T ? absorbed(s) / T : 0);
      // pose: the last step whose start is ≤ p
      let id = SEQ[0][1]; for (const [from, pid] of SEQ) if (p >= from) id = pid;
      if (!forcedPose) show(id);
      const d = Math.abs(p - SPIN);
      setT(me, 'transform', d < SPIN_W ? `scaleX(${(1 - SQUASH * (1 - d / SPIN_W)).toFixed(3)})` : '');
      // the name: letters drift apart and off the line, most at the back of the turn, together again at front
      const env = Math.sin(Math.PI * p), exit = forcedP === null ? Math.max(0, s - top0 - T) : 0, fs = hero.fs;
      letters.forEach(set => set.forEach((sp, i) => {
        const dx = DX[i] * fs * env, dy = DY[i] * fs * env - LIFT[i] * exit;
        setT(sp, 'translate', env || exit ? `${dx.toFixed(1)}px ${dy.toFixed(1)}px` : '');
      }));
      // the hero line inks in over the first fifth of the turn; at rest its first line is already dark
      ink(hero.words, clamp((p + .1) / .26), 3);
    }
    // which blocks are near the viewport: only those are drawn
    const near = new Set();
    const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? near.add(e.target) : near.delete(e.target)); tick(); },
      { rootMargin: '25% 0px 25% 0px' });
    [hero.el, ...blocks.map(b => b.el), ...builds.map(b => b.el)].forEach(el => io.observe(el));

    let raf = 0;
    function frame(all) {                                  // all: draw every block, near or not (after each measure)
      raf = 0;
      const s = scrollY, on = el => all === true || near.has(el);
      if (on(hero.el) || forcedP !== null) drawHero(s);
      for (const b of blocks) {
        if (!on(b.el)) continue;
        for (const l of b.lines) {
          const y = viewY(b.y + l.dy, b.pinned, s);
          ink(l.words, clamp((l.a - y) / (l.a - l.b)), 2);
        }
      }
      for (const b of builds) {
        if (!on(b.el)) continue;
        const k = clamp((b.a - viewY(b.y, false, s)) / (b.a - b.b)), n = b.chars.length, K = 4;
        b.chars.forEach((c, i) => {
          const f = clamp((k * (n + K) - i) / K), g = 1 - f, sc = b.scat[i];
          setO(c, .12 + .88 * f);
          setT(c, 'transform', g ? `translate(${(sc.x * g).toFixed(3)}em,${(sc.y * g).toFixed(3)}em) rotate(${(sc.r * g).toFixed(1)}deg)` : '');
        });
      }
    }
    const tick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener('scroll', tick, { passive: true });

    // re-measure whenever layout can change; ?progress then scrolls to its point of the turn
    const relayout = () => {
      measure();
      if (forcedP !== null) scrollTo({ top: top0 + forcedP * T, behavior: 'instant' });
      frame(true);
    };
    relayout();
    document.fonts?.ready.then(relayout);
    addEventListener('load', relayout);
    let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); });
  })();

  /* ------------------------------------------------------------ 2. desk */
  /* ≥1100px with JS: the objects sit at fixed places on a 1440×1900 artboard scaled to the window (a knolled grid:
     CV + photo | the two write-ups | three letters | six work-rights cards). With a mouse, pick one up; on release it
     springs back to its place, so the desk is always composed. A press that moves under 5px is a click and opens the
     PDF, which every document is anyway: a real <a> you can tab to and press Enter on (for a letter, the envelope is
     the <a> and the referee's own links sit under it). The work-rights cards are plain text in a list, not links.
     Narrower, the same groups stack (CSS only). */
  (function desk() {
    const desk = document.querySelector('.desk');
    const board = document.getElementById('board');
    if (!desk || !board) return;

    const W = 1440, H = 1900, MAX = 1.25;
    const wide = matchMedia('(min-width:1100px)');
    const fine = matchMedia('(hover:hover) and (pointer:fine)');
    const objs = [...board.querySelectorAll('.obj')];
    let s = 1, z = 10;

    function layout() {
      const on = wide.matches;
      desk.classList.toggle('on', on);
      desk.classList.toggle('drag-ok', on && fine.matches && !STATIC);
      if (!on) return;
      const vw = root.clientWidth;
      s = Math.min(vw / W, MAX);
      desk.style.setProperty('--s', s);
      desk.style.setProperty('--ox', ((vw - W * s) / 2) + 'px');
    }
    layout();
    addEventListener('resize', layout);
    wide.addEventListener?.('change', layout);
    fine.addEventListener?.('change', layout);

    // settle into place one after another as the desk scrolls into view
    const settle = () => objs.forEach((el, i) => setTimeout(() => el.classList.add('in'), STATIC || calm.matches ? 0 : 120 * i));
    if (STATIC || calm.matches || !('IntersectionObserver' in window)) settle();
    else {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { settle(); io.disconnect(); } }, { threshold: .12 });
      io.observe(board);
    }
    // arriving by keyboard or a #documents link: show them at once
    addEventListener('focusin', e => { if (desk.contains(e.target)) objs.forEach(el => el.classList.add('in')); });
    if (location.hash === '#documents') objs.forEach(el => el.classList.add('in'));

    objs.forEach(el => {
      el.style.zIndex = ++z;
      el.addEventListener('dragstart', e => e.preventDefault());
      const hx = parseFloat(el.style.getPropertyValue('--x')), hy = parseFloat(el.style.getPropertyValue('--y'));
      let x = hx, y = hy, t = 0, vx = 0, vy = 0, vt = 0;           // position, tilt and their velocities
      let sx, sy, ox, oy, lx, moved = false, raf = 0, last = 0;
      const put = () => {
        el.style.setProperty('--x', x + 'px'); el.style.setProperty('--y', y + 'px'); el.style.setProperty('--t', t + 'deg');
      };

      // damped spring back to (hx, hy, 0°): a little overshoot, then still
      const spring = now => {
        const dt = Math.min(.032, (now - last) / 1000 || .016); last = now;
        const K = 170, C = 19;
        vx += (-K * (x - hx) - C * vx) * dt; x += vx * dt;
        vy += (-K * (y - hy) - C * vy) * dt; y += vy * dt;
        vt += (-K * t - C * vt) * dt; t += vt * dt;
        put();
        if (Math.hypot(x - hx, y - hy, vx, vy) > .3 || Math.abs(t) > .02) raf = requestAnimationFrame(spring);
        else { x = hx; y = hy; t = 0; put(); el.classList.remove('live'); raf = 0; }
      };

      let pid = null;
      el.addEventListener('pointerdown', e => {
        if (!desk.classList.contains('drag-ok') || e.button !== 0 || e.target.closest('.ln')) return;
        pid = e.pointerId;                                   // captured only once it really drags (below), so a plain
        cancelAnimationFrame(raf); raf = 0;                  // press still lands as a click on the link under it
        sx = e.clientX; sy = e.clientY; ox = x; oy = y; lx = e.clientX; moved = false;
        el.style.zIndex = ++z; el.classList.add('drag', 'live');
      });
      el.addEventListener('pointermove', e => {
        if (!el.classList.contains('drag')) return;
        const dx = (e.clientX - sx) / s, dy = (e.clientY - sy) / s;
        if (!moved && Math.hypot(dx, dy) * s > 5) { moved = true; try { el.setPointerCapture(pid); } catch {} }
        if (!moved) return;
        const w = el.offsetWidth, h = el.offsetHeight;
        x = Math.max(-w * .3, Math.min(W - w * .7, ox + dx));
        y = Math.max(-h * .2, Math.min(H - h * .5, oy + dy));
        t = calm.matches ? 0 : Math.max(-6, Math.min(6, t * .6 + (e.clientX - lx) * .25));
        lx = e.clientX; put();
      });
      const release = () => {
        if (!el.classList.contains('drag')) return;
        el.classList.remove('drag');
        vx = vy = vt = 0;
        if (calm.matches) { x = hx; y = hy; t = 0; put(); el.classList.remove('live'); return; }
        last = performance.now(); raf = requestAnimationFrame(spring);
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      el.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } });
    });
  })();

  /* ------------------------------------------------------------ 3. cue */
  const onScroll = () => root.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();
