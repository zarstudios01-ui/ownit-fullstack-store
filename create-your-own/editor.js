(function () {
  'use strict';
  var CAL = /calibrate/.test(location.hash + location.search);
  var CFG = [
    { key: 'left', name: 'Left', kind: 'console', W: 1024, H: 1536,
      cut: '/images/templates/left-cut.png', photo: '/images/photos/console-left.jpg',
      quad: [[236,236],[748,82],[772,1355],[181,1338]] },
    { key: 'right', name: 'Right', kind: 'console', W: 1024, H: 1536,
      cut: '/images/templates/right-cut.png', photo: '/images/photos/console-right.jpg',
      quad: [[290,90],[810,208],[856,1330],[264,1380]] },
    { key: 'controller', name: 'Controller', kind: 'controller', W: 1536, H: 1024,
      photo: '/images/photos/controller.jpg', mirror: 1530,
      poly: [[352,182],[498,152],[530,156],[546,338],[505,432],[470,505],[430,572],[380,652],[336,732],[292,835],[262,888],[222,884],[182,842],[172,760],[184,600],[232,402],[300,250]] }
  ];
  if (CAL) {
    try {
      var sv = JSON.parse(localStorage.getItem('cyoCal') || 'null');
      if (sv) CFG.forEach(function (c) {
        var k = c.kind === 'console' ? 'quad' : 'poly';
        if (sv[c.key]) c[k] = sv[c.key];
      });
    } catch (e) {}
  }
  var P = CFG;
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('cyoCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
  var tabsEl = $('cyoTabs'), fileEl = $('cyoFile'), zoomEl = $('cyoZoom'),
      rotEl = $('cyoRot'), allEl = $('cyoAll'), guidesEl = $('cyoGuides'),
      warnEl = $('cyoWarn'), emptyEl = $('cyoEmpty');
  var actBtns = document.querySelectorAll('[data-cyo-act]');
  var cur = 0, raf = 0, view = 'photo', drag = null, calEl = null;

  function warn(m) { warnEl.textContent = m || ''; }
  function normDeg(r) { return ((r * 180 / Math.PI + 180) % 360 + 360) % 360 - 180; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function handles(p) { return p.kind === 'console' ? p.quad : p.poly; }
  function editable() { return true; }
  function needsPhoto(p) { return p.kind === 'controller' || view === 'photo'; }

  // ---------- masks ----------
  function buildMask(p) {
    var W = p.W, H = p.H, c = mk(W, H);
    var x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.drawImage(p.tpl, 0, 0, W, H);
    var img = x.getImageData(0, 0, W, H), d = img.data;
    var n = W * H, seen = new Uint8Array(n), stack = new Int32Array(n), sp = 0;
    function tryPush(i) { if (!seen[i] && d[i * 4] > 215) { seen[i] = 1; stack[sp++] = i; } }
    tryPush(0);
    while (sp) {
      var i = stack[--sp], px = i % W;
      if (px > 0) tryPush(i - 1);
      if (px < W - 1) tryPush(i + 1);
      if (i >= W) tryPush(i - W);
      if (i < n - W) tryPush(i + W);
    }
    var x0 = W, y0 = H, x1 = 0, y1 = 0, inside = 0;
    var tl = [0, 0], tr = [W, 0], br = [W, H], bl = [0, H];
    var tlS = 1e9, brS = -1e9, trS = -1e9, blS = -1e9;
    for (var j = 0; j < n; j++) {
      if (seen[j]) { d[j * 4 + 3] = 0; continue; }
      d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = 0; d[j * 4 + 3] = 255; inside++;
      var xx = j % W, yy = (j / W) | 0, s = xx + yy, df = xx - yy;
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
      if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      if (s < tlS) { tlS = s; tl = [xx, yy]; }
      if (s > brS) { brS = s; br = [xx, yy]; }
      if (df > trS) { trS = df; tr = [xx, yy]; }
      if (-df > blS) { blS = -df; bl = [xx, yy]; }
    }
    if (inside < n * 0.1) { p.mask = null; return; }
    x.putImageData(img, 0, 0);
    p.mask = c;
    p.bbox = { x0: x0, y0: y0, x1: x1, y1: y1 };
    p.corners = [tl, tr, br, bl];
  }
  function buildPolyMask(p) {
    var c = mk(p.W, p.H), x = c.getContext('2d');
    var mir = p.poly.map(function (q) { return [p.mirror - q[0], q[1]]; });
    var x0 = p.W, y0 = p.H, x1 = 0, y1 = 0;
    x.fillStyle = '#000';
    [p.poly, mir].forEach(function (pts) {
      x.beginPath();
      pts.forEach(function (q, i) {
        if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]);
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
      });
      x.closePath(); x.fill();
    });
    p.mask = c; p.bbox = { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function fitPanel(p) {
    if (!p.img) return;
    var b = p.bbox;
    p.fit = Math.max((b.x1 - b.x0) / p.img.width, (b.y1 - b.y0) / p.img.height);
    p.t = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: p.fit, r: 0 };
  }

  // ---------- perspective-ish warp (grid of affine triangles) ----------
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function bil(q, u, v) { return lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v); }
  function tri(dc, img, s0, s1, s2, d0, d1, d2) {
    var u1 = s1[0] - s0[0], v1 = s1[1] - s0[1], u2 = s2[0] - s0[0], v2 = s2[1] - s0[1];
    var det = u1 * v2 - u2 * v1;
    if (!det) return;
    var X1 = d1[0] - d0[0], X2 = d2[0] - d0[0], Y1 = d1[1] - d0[1], Y2 = d2[1] - d0[1];
    var a = (X1 * v2 - X2 * v1) / det, c = (u1 * X2 - u2 * X1) / det;
    var b = (Y1 * v2 - Y2 * v1) / det, d = (u1 * Y2 - u2 * Y1) / det;
    var e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
    var cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    dc.save(); dc.beginPath();
    [d0, d1, d2].forEach(function (q, k) {
      var dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1;
      var px = q[0] + dx / l * 0.8, py = q[1] + dy / l * 0.8;
      if (k) dc.lineTo(px, py); else dc.moveTo(px, py);
    });
    dc.closePath(); dc.clip();
    dc.setTransform(a, b, c, d, e, f);
    var bx0 = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0])) - 1);
    var by0 = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1])) - 1);
    var bx1 = Math.min(img.width, Math.ceil(Math.max(s0[0], s1[0], s2[0])) + 1);
    var by1 = Math.min(img.height, Math.ceil(Math.max(s0[1], s1[1], s2[1])) + 1);
    if (bx1 > bx0 && by1 > by0) dc.drawImage(img, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
    dc.restore();
  }
  function warp(dc, src, sq, dq) {
    var N = 12, M = 18;
    for (var j = 0; j < M; j++) for (var i = 0; i < N; i++) {
      var u0 = i / N, u1 = (i + 1) / N, v0 = j / M, v1 = (j + 1) / M;
      var s00 = bil(sq, u0, v0), s10 = bil(sq, u1, v0), s01 = bil(sq, u0, v1), s11 = bil(sq, u1, v1);
      var d00 = bil(dq, u0, v0), d10 = bil(dq, u1, v0), d01 = bil(dq, u0, v1), d11 = bil(dq, u1, v1);
      tri(dc, src, s00, s10, s01, d00, d10, d01);
      tri(dc, src, s10, s11, s01, d10, d11, d01);
    }
  }

  // ---------- drawing ----------
  function renderArt(p) {
    var a = p.actx;
    a.globalCompositeOperation = 'source-over';
    a.clearRect(0, 0, p.W, p.H);
    a.fillStyle = '#fff'; a.fillRect(0, 0, p.W, p.H);
    if (p.img) {
      var t = p.t;
      a.save(); a.translate(t.x, t.y); a.rotate(t.r); a.scale(t.s, t.s);
      a.drawImage(p.img, -p.img.width / 2, -p.img.height / 2); a.restore();
    }
    if (p.mask) {
      a.globalCompositeOperation = 'destination-in';
      a.drawImage(p.mask, 0, 0);
      a.globalCompositeOperation = 'source-over';
    }
  }
  function drawHandles(p) {
    if (p.kind === 'console' && view !== 'photo') return;
    var h = handles(p);
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#C4181A'; ctx.beginPath();
    h.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.closePath(); ctx.stroke();
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    h.forEach(function (q, i) {
      ctx.fillStyle = '#C4181A'; ctx.beginPath(); ctx.arc(q[0], q[1], 16, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(i, q[0], q[1]);
    });
    ctx.restore();
  }
  function draw() {
    var p = P[cur];
    renderArt(p);
    ctx.globalCompositeOperation = 'source-over';
    if (p.kind === 'console' && view === 'flat') {
      ctx.fillStyle = '#F2F1EC'; ctx.fillRect(0, 0, p.W, p.H);
      ctx.drawImage(p.art, 0, 0);
      if (p.tpl && guidesEl.checked) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(p.tpl, 0, 0, p.W, p.H);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      if (p.phImg) ctx.drawImage(p.phImg, 0, 0, p.W, p.H);
      else { ctx.fillStyle = '#E7E5DE'; ctx.fillRect(0, 0, p.W, p.H); }
      if (p.img) {
        if (p.kind === 'console') {
          tctx.setTransform(1, 0, 0, 1, 0, 0);
          tctx.clearRect(0, 0, tmp.width, tmp.height);
          warp(tctx, p.art, p.corners, p.quad);
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(tmp, 0, 0);
        } else {
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(p.art, 0, 0);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (CAL) drawHandles(p);
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; draw(); });
  }
  function ensurePhoto(p, done) {
    if (p.phImg || p.phLoading) return;
    p.phLoading = true;
    var im = new Image();
    im.onload = function () { p.phImg = im; p.phLoading = false; done(); };
    im.onerror = function () { p.phLoading = false; warn('Photo not found: ' + p.photo); };
    im.src = p.photo;
  }

  // ---------- UI ----------
  var viewEl = document.createElement('div');
  viewEl.className = 'cyo-tabs';
  var vBtns = {};
  [['flat', 'Flat template'], ['photo', 'On console']].forEach(function (v) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cyo-tab'; b.textContent = v[1];
    b.setAttribute('aria-selected', v[0] === view ? 'true' : 'false');
    b.addEventListener('click', function () {
      view = v[0];
      Object.keys(vBtns).forEach(function (k) { vBtns[k].setAttribute('aria-selected', k === view ? 'true' : 'false'); });
      sync(); draw();
      var p = P[cur];
      if (needsPhoto(p)) ensurePhoto(p, function () { if (P[cur] === p) draw(); });
    });
    vBtns[v[0]] = b; viewEl.appendChild(b);
  });
  tabsEl.parentNode.insertBefore(viewEl, tabsEl.nextSibling);

  function sync() {
    var p = P[cur], has = !!p.img;
    zoomEl.disabled = rotEl.disabled = !has;
    Array.prototype.forEach.call(actBtns, function (b) { b.disabled = !has; });
    emptyEl.style.display = has ? 'none' : '';
    viewEl.style.display = p.kind === 'console' ? '' : 'none';
    canvas.style.touchAction = has ? 'none' : 'pan-y';
    if (has) {
      zoomEl.value = Math.round(p.t.s / p.fit * 100);
      rotEl.value = Math.round(normDeg(p.t.r));
    }
  }
  function select(i) {
    cur = i;
    var p = P[i];
    canvas.width = p.W; canvas.height = p.H; tmp.width = p.W; tmp.height = p.H;
    P.forEach(function (q, k) { q.btn.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    sync(); draw();
    if (needsPhoto(p)) ensurePhoto(p, function () { if (P[cur] === p) draw(); });
  }

  P.forEach(function (p, i) {
    p.art = mk(p.W, p.H); p.actx = p.art.getContext('2d');
    p.img = null; p.tpl = null; p.mask = null; p.phImg = null; p.phLoading = false;
    p.t = { x: p.W / 2, y: p.H / 2, s: 1, r: 0 }; p.fit = 1;
    p.bbox = { x0: 0, y0: 0, x1: p.W, y1: p.H };
    p.corners = [[0, 0], [p.W, 0], [p.W, p.H], [0, p.H]];
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cyo-tab'; b.setAttribute('role', 'tab');
    b.textContent = p.name;
    b.addEventListener('click', function () { select(i); });
    tabsEl.appendChild(b); p.btn = b;
    if (p.kind === 'controller') buildPolyMask(p);
    else {
      var im = new Image();
      im.onload = function () { p.tpl = im; buildMask(p); if (P[cur] === p) draw(); };
      im.onerror = function () { warn('Template not found: ' + p.cut); };
      im.src = p.cut;
    }
  });

  if (CAL) {
    calEl = document.createElement('pre');
    calEl.style.cssText = 'white-space:pre-wrap;word-break:break-all;font:11px monospace;margin-top:10px;';
    document.querySelector('.cyo-stage').appendChild(calEl);
    warn('Calibrate mode: drag the red handles. Console: use "On console".');
  }
  function calOut() {
    if (!CAL || !calEl) return;
    var o = {};
    P.forEach(function (p) { o[p.key] = handles(p); });
    var s = JSON.stringify(o);
    calEl.textContent = s;
    try { localStorage.setItem('cyoCal', s); } catch (e) {}
  }
  calOut();

  // ---------- upload + controls ----------
  fileEl.addEventListener('change', function () {
    var f = fileEl.files && fileEl.files[0];
    fileEl.value = '';
    if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      var targets = allEl.checked ? P : [P[cur]];
      targets.forEach(function (p) { p.img = im; fitPanel(p); });
      warn(Math.min(im.width, im.height) < 800 ? 'Low resolution: this image may look soft when printed.' : '');
      sync(); draw();
    };
    im.onerror = function () { URL.revokeObjectURL(url); warn('Could not read that file. Try a JPG or PNG.'); };
    im.src = url;
  });
  zoomEl.addEventListener('input', function () {
    var p = P[cur]; if (!p.img) return;
    p.t.s = p.fit * zoomEl.value / 100; schedule();
  });
  rotEl.addEventListener('input', function () {
    var p = P[cur]; if (!p.img) return;
    p.t.r = rotEl.value * Math.PI / 180; schedule();
  });
  guidesEl.addEventListener('change', draw);
  Array.prototype.forEach.call(actBtns, function (b) {
    b.addEventListener('click', function () {
      var p = P[cur]; if (!p.img) return;
      var a = b.getAttribute('data-cyo-act');
      if (a === 'fit') fitPanel(p);
      else if (a === 'center') { p.t.x = (p.bbox.x0 + p.bbox.x1) / 2; p.t.y = (p.bbox.y0 + p.bbox.y1) / 2; }
      else if (a === 'rot90') p.t.r += Math.PI / 2;
      sync(); schedule();
    });
  });

  // ---------- gestures ----------
  var ptrs = new Map(), prev = null;
  function invBil(q, x, y) {
    var u = .5, v = .5;
    for (var k = 0; k < 10; k++) {
      var f = bil(q, u, v), ex = f[0] - x, ey = f[1] - y;
      var a = (1 - v) * (q[1][0] - q[0][0]) + v * (q[2][0] - q[3][0]);
      var b = (1 - u) * (q[3][0] - q[0][0]) + u * (q[2][0] - q[1][0]);
      var c = (1 - v) * (q[1][1] - q[0][1]) + v * (q[2][1] - q[3][1]);
      var d = (1 - u) * (q[3][1] - q[0][1]) + u * (q[2][1] - q[1][1]);
      var det = a * d - b * c;
      if (!det) break;
      u -= (d * ex - b * ey) / det;
      v -= (-c * ex + a * ey) / det;
    }
    return [u, v];
  }
  function ptA(e) {
    var m = pt(e), p = P[cur];
    if (p.kind === 'console' && view === 'photo') {
      var uv = invBil(p.quad, m.x, m.y), s = bil(p.corners, uv[0], uv[1]);
      return { x: s[0], y: s[1] };
    }
    return m;
  }
  function pt(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  }
  function gesture() {
    var a = Array.from(ptrs.values());
    if (a.length === 1) return { n: 1, x: a[0].x, y: a[0].y };
    if (a.length >= 2) {
      var p = a[0], q = a[1];
      return { n: 2, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2,
               d: Math.hypot(q.x - p.x, q.y - p.y) || 1, a: Math.atan2(q.y - p.y, q.x - p.x) };
    }
    return null;
  }
  function clampScale(p, s) { return Math.min(p.fit * 6, Math.max(p.fit * 0.2, s)); }
  function hit(p, m) {
    if (p.kind === 'console' && view !== 'photo') return -1;
    var h = handles(p), best = -1, bd = 70;
    h.forEach(function (q, i) { var d = Math.hypot(q[0] - m.x, q[1] - m.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  canvas.addEventListener('pointerdown', function (e) {
    var p = P[cur];
    if (CAL) {
      var h = hit(p, pt(e));
      if (h >= 0) { drag = h; canvas.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    }
    if (!p.img || !editable()) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, ptA(e)); prev = gesture(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (drag !== null) {
      var m = pt(e), hh = handles(P[cur]);
      hh[drag][0] = Math.round(m.x); hh[drag][1] = Math.round(m.y);
      if (P[cur].kind === 'controller') buildPolyMask(P[cur]);
      calOut(); schedule(); return;
    }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, ptA(e));
    var g = gesture(), p = P[cur], t = p.t;
    if (g && prev && g.n === 1 && prev.n === 1) {
      t.x += g.x - prev.x; t.y += g.y - prev.y;
    } else if (g && prev && g.n === 2 && prev.n === 2) {
      var k = g.d / prev.d, dr = g.a - prev.a;
      var vx = t.x - prev.x, vy = t.y - prev.y, c = Math.cos(dr), s = Math.sin(dr);
      t.x = g.x + k * (vx * c - vy * s);
      t.y = g.y + k * (vx * s + vy * c);
      t.s = clampScale(p, t.s * k); t.r += dr;
    }
    prev = g; sync(); schedule();
  });
  function end(e) {
    if (drag !== null) { drag = null; return; }
    ptrs.delete(e.pointerId); prev = gesture();
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', function (e) {
    var p = P[cur]; if (!p.img || !editable()) return;
    e.preventDefault();
    var m = ptA(e), k = Math.exp(-e.deltaY * 0.0015), t = p.t;
    t.x = m.x + k * (t.x - m.x); t.y = m.y + k * (t.y - m.y);
    t.s = clampScale(p, t.s * k); sync(); schedule();
  }, { passive: false });

  select(0);
})();
