(function () {
  var btn = document.getElementById('cyoConfirm'), msg = document.getElementById('cyoConfirmMsg');
  if (!btn) return;
  function say(t) { msg.textContent = t; }
  function exportPanel(p) {
    var S = 0.75, c = document.createElement('canvas');
    c.width = Math.round(p.W * S); c.height = Math.round(p.H * S);
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.save(); x.scale(S, S);
    x.translate(p.t.x, p.t.y); x.rotate(p.t.r); x.scale(p.t.s, p.t.s);
    x.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
    x.restore();
    return c.toDataURL('image/jpeg', 0.85);
  }
  btn.addEventListener('click', function () {
    var panels = (window.cyoPanels || []).filter(function (p) { return p.img; });
    if (!panels.length) return say('Upload artwork first.');
    btn.disabled = true; say('Saving your design...');
    var body = JSON.stringify({ panels: panels.map(function (p) {
      return { key: p.key, kind: p.kind, image: exportPanel(p),
               transform: { x: p.t.x, y: p.t.y, s: p.t.s, r: p.t.r, fit: p.fit } };
    }) });
    if (body.length > 4200000) { btn.disabled = false; return say('Artwork too large. Try fewer panels.'); }
    fetch('/api/designs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (o) {
        if (!o.ok) throw new Error(o.j.error || 'Save failed');
        try { localStorage.setItem('cyoDesignId', o.j.design_id); } catch (e) {}
        document.dispatchEvent(new CustomEvent('cyo:saved', { detail: o.j.design_id }));
        say('Design saved. ID: ' + o.j.design_id);
      })
      .catch(function (e) { say('Could not save: ' + e.message); })
      .then(function () { btn.disabled = false; });
  });
})();
