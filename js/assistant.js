/* OwnIt AI Assistant — floating chat widget.
   Self-contained: injects its own CSS and DOM, so a single
   <script src="js/assistant.js"></script> is all any page needs.
   Talks to /api/chat (Vercel serverless function) — never calls Groq directly. */
(function () {
  const SESSION_KEY = 'ownit_assistant_history';
  const GREETING = "Assalam o alaikum! Main OwnIt ka assistant hoon 🎮 Kis design ki talaash hai — koi character skin ya khud ka design banwana hai?";

  const css = `
  .oa-launcher{
    position:fixed;bottom:24px;right:24px;z-index:180;
    width:60px;height:60px;border-radius:50%;
    background:var(--white);color:var(--paper);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 10px 24px rgba(0,0,0,.25);
    font-family:var(--display);font-size:22px;
    border:1.5px solid var(--ink);cursor:pointer;
    transition:transform .2s ease, background .2s ease, bottom .25s ease;
    overflow:hidden;padding:0;
  }
  .oa-launcher-img{width:100%;height:100%;object-fit:contain;padding:5px;}
  .oa-launcher:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(0,0,0,.3);}
  .oa-launcher .oa-dot{
    position:absolute;top:-4px;right:-4px;width:12px;height:12px;border-radius:50%;
    background:var(--blood);border:2px solid var(--paper);
  }
  .oa-launcher.oa-lifted{bottom:96px;}
  @media(max-width:640px){
    .oa-launcher{bottom:18px;right:18px;width:50px;height:50px;}
    .oa-launcher.oa-lifted{bottom:88px;}
  }

  .oa-overlay{position:fixed;inset:0;background:rgba(21,21,18,.35);z-index:190;opacity:0;pointer-events:none;transition:opacity .2s ease;}
  .oa-overlay.open{opacity:1;pointer-events:auto;}

  .oa-panel{
    position:fixed;bottom:24px;right:24px;z-index:191;
    width:min(380px,92vw);height:min(560px,80vh);
    background:var(--paper);border:1.5px solid var(--ink);
    display:flex;flex-direction:column;
    box-shadow:0 24px 50px rgba(0,0,0,.28);
    transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;
    transition:all .22s cubic-bezier(.32,.72,0,1);
  }
  .oa-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:auto;}
  @media(max-width:640px){.oa-panel{bottom:0;right:0;left:0;width:100%;height:78vh;border-left:0;border-right:0;border-bottom:0;}}

  .oa-head{
    display:flex;justify-content:space-between;align-items:center;
    padding:16px 18px;border-bottom:1px solid var(--line);background:var(--white);
  }
  .oa-head-title{display:flex;align-items:center;gap:10px;}
  .oa-head-title img{width:34px;height:34px;object-fit:contain;}
  .oa-head-title-text{display:flex;flex-direction:column;}
  .oa-head-title-text h3{font-family:var(--display);font-size:20px;text-transform:uppercase;letter-spacing:.02em;line-height:1;}
  .oa-head-title-text span{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--blood);margin-top:4px;}
  .oa-close{font-family:var(--mono);font-size:11px;text-transform:uppercase;color:var(--graphite);background:none;border:none;cursor:pointer;}
  .oa-close:hover{color:var(--ink);}

  .oa-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;background:var(--paper);}
  .oa-msg{max-width:82%;padding:10px 13px;font-size:13.5px;line-height:1.45;border:1px solid var(--line);}
  .oa-msg.user{align-self:flex-end;background:var(--ink);color:var(--paper);border-color:var(--ink);}
  .oa-msg.assistant{align-self:flex-start;background:var(--white);color:var(--ink-soft);}
  .oa-msg.error{align-self:flex-start;background:var(--white);color:var(--blood);border-color:var(--blood);}

  .oa-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:var(--white);border:1px solid var(--line);}
  .oa-typing span{width:6px;height:6px;border-radius:50%;background:var(--graphite);animation:oa-bounce 1.1s infinite ease-in-out;}
  .oa-typing span:nth-child(2){animation-delay:.15s;}
  .oa-typing span:nth-child(3){animation-delay:.3s;}
  @keyframes oa-bounce{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-4px);opacity:1;}}

  .oa-inputrow{display:flex;gap:8px;padding:14px;border-top:1px solid var(--line);background:var(--white);}
  .oa-inputrow input{
    flex:1;padding:11px 13px;border:1.5px solid var(--line);background:var(--paper);
    font-family:var(--body);font-size:13.5px;color:var(--ink);
  }
  .oa-inputrow input:focus{outline:none;border-color:var(--ink);}
  .oa-inputrow button{
    padding:0 16px;border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);
    font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;
  }
  .oa-inputrow button:hover:not(:disabled){background:var(--blood);border-color:var(--blood);}
  .oa-inputrow button:disabled{opacity:.4;cursor:not-allowed;}
  `;

  function injectStyles() {
    if (document.getElementById('oa-styles')) return;
    const style = document.createElement('style');
    style.id = 'oa-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectDOM() {
    if (document.getElementById('oaLauncher')) return;

    const launcher = document.createElement('button');
    launcher.id = 'oaLauncher';
    launcher.className = 'oa-launcher';
    launcher.setAttribute('aria-label', 'Chat with OwnIt assistant');
    launcher.innerHTML = '<img src="/images/logo-ownit.png" alt="OwnIt Assistant" class="oa-launcher-img"><span class="oa-dot"></span>';
    document.body.appendChild(launcher);

    const overlay = document.createElement('div');
    overlay.id = 'oaOverlay';
    overlay.className = 'oa-overlay';
    document.body.appendChild(overlay);

    const panel = document.createElement('div');
    panel.id = 'oaPanel';
    panel.className = 'oa-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'OwnIt AI assistant chat');
    panel.innerHTML =
      '<div class="oa-head">' +
        '<div class="oa-head-title"><img src="/images/logo-ownit.png" alt="OwnIt"><div class="oa-head-title-text"><h3>OwnIt Assistant</h3><span>AI &middot; Roman Urdu</span></div></div>' +
        '<button class="oa-close" id="oaClose">Close ✕</button>' +
      '</div>' +
      '<div class="oa-body" id="oaBody"></div>' +
      '<div class="oa-inputrow">' +
        '<input type="text" id="oaInput" placeholder="Apna sawal likhein..." autocomplete="off">' +
        '<button id="oaSend" type="button">Send</button>' +
      '</div>';
    document.body.appendChild(panel);

    launcher.addEventListener('click', openPanel);
    overlay.addEventListener('click', closePanel);
    document.getElementById('oaClose').addEventListener('click', closePanel);
    document.getElementById('oaSend').addEventListener('click', sendMessage);
    document.getElementById('oaInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function readHistory() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || []; }
    catch (e) { return []; }
  }
  function writeHistory(items) {
    // Keep session storage bounded
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(items.slice(-20)));
  }

  function renderMessage(role, text) {
    const body = document.getElementById('oaBody');
    const div = document.createElement('div');
    div.className = 'oa-msg ' + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const body = document.getElementById('oaBody');
    const el = document.createElement('div');
    el.className = 'oa-typing';
    el.id = 'oaTyping';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('oaTyping');
    if (el) el.remove();
  }

  function renderAll() {
    const body = document.getElementById('oaBody');
    body.innerHTML = '';
    const history = readHistory();
    if (history.length === 0) {
      renderMessage('assistant', GREETING);
    } else {
      history.forEach((m) => renderMessage(m.role, m.content));
    }
  }

  function openPanel() {
    injectDOM();
    document.getElementById('oaPanel').classList.add('open');
    document.getElementById('oaOverlay').classList.add('open');
    renderAll();
    document.getElementById('oaInput').focus();
  }
  function closePanel() {
    const panel = document.getElementById('oaPanel');
    const overlay = document.getElementById('oaOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  async function sendMessage() {
    const input = document.getElementById('oaInput');
    const sendBtn = document.getElementById('oaSend');
    const text = input.value.trim();
    if (!text) return;

    const history = readHistory();
    history.push({ role: 'user', content: text });
    writeHistory(history);
    renderMessage('user', text);
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, session_id: (function(){try{var k='oa_sid',s=sessionStorage.getItem(k);if(!s){s=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem(k,s);}return s;}catch(e){return '';}})() }),
      });
      const data = await res.json();
      hideTyping();

      if (!res.ok) {
        renderMessage('error', data.error || 'Kuch masla ho gaya. Dobara try karein.');
      } else {
        history.push({ role: 'assistant', content: data.reply });
        writeHistory(history);
        renderMessage('assistant', data.reply);
      }
    } catch (err) {
      hideTyping();
      renderMessage('error', 'Connection issue aa raha hai. Thodi dair baad try karein.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    injectDOM();
    watchStickyBar();
  });

  // On PDP pages, a sticky Add-to-Cart bar slides up from the bottom once you
  // scroll past the main button — lift the chat launcher above it so they
  // never overlap.
  function watchStickyBar() {
    const stickyBar = document.getElementById('stickyBar');
    const launcher = document.getElementById('oaLauncher');
    if (!stickyBar || !launcher) return;

    function sync() {
      launcher.classList.toggle('oa-lifted', stickyBar.classList.contains('show'));
    }
    sync();
    new MutationObserver(sync).observe(stickyBar, { attributes: true, attributeFilter: ['class'] });
  }
})();
