(function () {
  'use strict';
  var W = 1024, H = 1536;
  var PANELS = [
    { name: 'Left', src: '/images/Left.png' },
    { name: 'Right', src: '/images/Right.png' }
  ];
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('cyoCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var art = document.createElement('canvas');
  art.width = W; art.height = H;
  var actx = art.getContext('2d');
  var tabsEl = $('cyoTabs'), fileEl = $('cyoFile'), zoomEl = $('cyoZoom'),
      rotEl = $('cyoRot'), allEl = $('cyoAll'), guidesEl = $('cyoGuides'),
      warnEl = $('cyoWarn'), emptyEl = $('cyoEmpty');
  var actBtns = document.querySelectorAll('[data-cyo-act]');
  var cur = 0, raf = 0;

  function warn(msg) { warnEl.textContent = msg || ''; }
  function normDeg(r) { return ((r * 180 / Math.PI + 180) % 360 + 360) % 360 - 180; }

  function buildMask(p) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
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
    for (var j = 0; j < n; j++) {
      if (seen[j]) { d[j * 4 + 3] = 0; }
      else {
        d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = 0; d[j * 4 + 3] = 255; inside++;
        var xx = j % W, yy = (j / W) | 0;
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
    }
    if (inside < n * 0.1) { p.mask = null; return; }
    x.putImageData(img, 0, 0);
    p.mask = c;
    p.bbox = { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function fitPanel(p) {
    if (!p.img) return;
    var b = p.bbox;
    p.fit = Math.max((b.x1 - b.x0) / p.img.width, (b.y1 - b.y0) / p.img.height);
    p.t = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: p.fit, r: 0 };
  }

  function draw(p) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F2F1EC'; ctx.fillRect(0, 0, W, H);
    actx.globalCompositeOperation = 'source-over';
    actx.clearRect(0, 0, W, H);
    actx.fillStyle = '#fff'; actx.fillRect(0, 0, W, H);
    if (p.img) {
      var t = p.t;
      actx.save();
      actx.translate(t.x, t.y); actx.rotate(t.r); actx.scale(t.s, t.s);
      actx.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
      actx.restore();
    }
    if (p.mask) {
      actx.globalCompositeOperation = 'destination-in';
      actx.drawImage(p.mask, 0, 0);
      actx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(art, 0, 0);
    if (p.tpl && guidesEl.checked) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(p.tpl, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    p.thumb.clearRect(0, 0, 52, 78);
    p.thumb.drawImage(canvas, 0, 0, 52, 78);
  }
  function renderAll() {
    PANELS.forEach(function (p, i) { if (i !== cur) draw(p); });
    draw(PANELS[cur]);
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; draw(PANELS[cur]); });
  }

  function sync() {
    var p = PANELS[cur], has = !!p.img;
    zoomEl.disabled = rotEl.disabled = !has;
    Array.prototype.forEach.call(actBtns, function (b) { b.disabled = !has; });
    emptyEl.style.display = has ? 'none' : '';
    if (has) {
      zoomEl.value = Math.round(p.t.s / p.fit * 100);
      rotEl.value = Math.round(normDeg(p.t.r));
    }
  }
  function select(i) {
    cur = i;
    PANELS.forEach(function (p, k) { p.btn.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    sync();
    draw(PANELS[cur]);
  }

  PANELS.forEach(function (p, i) {
    p.t = { x: W / 2, y: H / 2, s: 1, r: 0 };
    p.fit = 1; p.img = null; p.tpl = null; p.mask = null;
    p.bbox = { x0: 0, y0: 0, x1: W, y1: H };
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cyo-tab'; b.setAttribute('role', 'tab');
    var th = document.createElement('canvas'); th.width = 52; th.height = 78;
    var lb = document.createElement('span'); lb.textContent = p.name;
    b.appendChild(th); b.appendChild(lb); tabsEl.appendChild(b);
    p.btn = b; p.thumb = th.getContext('2d');
    b.addEventListener('click', function () { select(i); });
  });
  var pending = PANELS.length;
  function loaded() { if (--pending === 0) renderAll(); }
  PANELS.forEach(function (p) {
    var im = new Image();
    im.onload = function () { p.tpl = im; buildMask(p); loaded(); };
    im.onerror = function () { warn('Template not found: ' + p.src); loaded(); };
    im.src = p.src;
  });

  fileEl.addEventListener('change', function () {
    var f = fileEl.files && fileEl.files[0];
    fileEl.value = '';
    if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      URL.revokeObjectURL(url);
      var targets = allEl.checked ? PANELS : [PANELS[cur]];
      targets.forEach(function (p) { p.img = im; fitPanel(p); });
      warn(Math.min(im.width, im.height) < 800 ? 'Low resolution: this image may look soft when printed.' : '');
      sync(); renderAll();
    };
    im.onerror = function () { URL.revokeObjectURL(url); warn('Could not read that file. Try a JPG or PNG.'); };
    im.src = url;
  });

  zoomEl.addEventListener('input', function () {
    var p = PANELS[cur]; if (!p.img) return;
    p.t.s = p.fit * zoomEl.value / 100; schedule();
  });
  rotEl.addEventListener('input', function () {
    var p = PANELS[cur]; if (!p.img) return;
    p.t.r = rotEl.value * Math.PI / 180; schedule();
  });
  guidesEl.addEventListener('change', renderAll);
  Array.prototype.forEach.call(actBtns, function (b) {
    b.addEventListener('click', function () {
      var p = PANELS[cur]; if (!p.img) return;
      var a = b.getAttribute('data-cyo-act');
      if (a === 'fit') fitPanel(p);
      else if (a === 'center') { p.t.x = (p.bbox.x0 + p.bbox.x1) / 2; p.t.y = (p.bbox.y0 + p.bbox.y1) / 2; }
      else if (a === 'rot90') p.t.r += Math.PI / 2;
      sync(); schedule();
    });
  });

  var ptrs = new Map(), prev = null;
  function pt(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
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
  canvas.addEventListener('pointerdown', function (e) {
    if (!PANELS[cur].img) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, pt(e)); prev = gesture(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, pt(e));
    var g = gesture(), p = PANELS[cur], t = p.t;
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
  function end(e) { ptrs.delete(e.pointerId); prev = gesture(); }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', function (e) {
    var p = PANELS[cur]; if (!p.img) return;
    e.preventDefault();
    var m = pt(e), k = Math.exp(-e.deltaY * 0.0015), t = p.t;
    t.x = m.x + k * (t.x - m.x); t.y = m.y + k * (t.y - m.y);
    t.s = clampScale(p, t.s * k); sync(); schedule();
  }, { passive: false });

  select(0);
})();
