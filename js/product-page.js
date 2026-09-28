const body = document.body;
const productSlug = body.dataset.productSlug;
const productName = body.dataset.productName;

const state = { model: 'PS5 Disc', coverage: null, price: 0, qty: 1 };

const priceDisplay = document.getElementById('priceDisplay');
const stickyPrice = document.getElementById('stickyPrice');
const mainImage = document.getElementById('mainImage');
const coverageSelected = document.getElementById('coverageSelected');
const modelSelected = document.getElementById('modelSelected');

const activeCoverage = document.querySelector('#coveragePills .coverage-card.active') || document.querySelector('#coveragePills .coverage-card');
if (activeCoverage) {
  state.coverage = activeCoverage.dataset.coverage;
  state.price = parseFloat(activeCoverage.dataset.price);
}

function formatPrice(p){ return window.OwnItCart.pkr(p); }
function refreshPrice(){
  const total = state.price * state.qty;
  priceDisplay.textContent = window.OwnItCart.pkr(state.price);
  stickyPrice.textContent = formatPrice(total);
}

document.querySelectorAll('#modelPills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#modelPills .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.model = btn.dataset.model;
    modelSelected.textContent = state.model;
  });
});

document.querySelectorAll('#coveragePills .coverage-card').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#coveragePills .coverage-card').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.coverage = btn.dataset.coverage;
    state.price = parseFloat(btn.dataset.price);
    coverageSelected.textContent = state.coverage;
    mainImage.src = btn.dataset.img;
    document.querySelectorAll('.gallery-thumb').forEach(t => {
      t.classList.toggle('active', t.dataset.img === btn.dataset.img);
      t.setAttribute('aria-selected', t.dataset.img === btn.dataset.img ? 'true' : 'false');
    });
    refreshPrice();
  });
});

document.querySelectorAll('.gallery-thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    mainImage.src = thumb.dataset.img;
    document.querySelectorAll('.gallery-thumb').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    thumb.classList.add('active');
    thumb.setAttribute('aria-selected','true');
  });
});

const qtyValue = document.getElementById('qtyValue');
document.getElementById('qtyMinus').addEventListener('click', () => {
  state.qty = Math.max(1, state.qty - 1);
  qtyValue.textContent = state.qty;
  refreshPrice();
});
document.getElementById('qtyPlus').addEventListener('click', () => {
  state.qty = Math.min(9, state.qty + 1);
  qtyValue.textContent = state.qty;
  refreshPrice();
});

function addMainToCart(){
  window.OwnItCart.addToCart({
    id: productSlug,
    name: productName,
    variant: state.model + ' · ' + state.coverage,
    price: state.price,
    image: mainImage.src,
    qty: state.qty
  });
}
document.getElementById('addToCartBtn').addEventListener('click', addMainToCart);
document.getElementById('stickyAddBtn').addEventListener('click', addMainToCart);

const bundleBtn = document.getElementById('bundleAddBtn');
if (bundleBtn) {
  bundleBtn.addEventListener('click', () => {
    window.OwnItCart.addToCart({
      id: productSlug + '-controller',
      name: productName + ' Controller Skin',
      variant: 'Controller Only',
      price: 500,
      image: bundleBtn.dataset.img || mainImage.src,
      qty: 1
    });
  });
}

const stickyBar = document.getElementById('stickyBar');
const addBtnRef = document.getElementById('addToCartBtn');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => stickyBar.classList.toggle('show', !entry.isIntersecting));
}, { threshold: 0 });
observer.observe(addBtnRef);

refreshPrice();

(function () {
  var slug = document.body.getAttribute('data-product-slug');
  var form = document.getElementById('reviewForm');
  if (!slug || !form) return;
  var rating = 0, msg = document.getElementById('reviewMsg');
  var btns = document.querySelectorAll('#starInput button');
  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}
  function stars(n){var f=Math.round(n);return '★★★★★☆☆☆☆☆'.slice(5-f,10-f);}
  function paint(){btns.forEach(function(b){b.classList.toggle('on',+b.dataset.v<=rating);});}
  btns.forEach(function(b){b.addEventListener('click',function(){rating=+b.dataset.v;paint();});});
  function render(data){
    var s=data.summary,c=+s.c,avg=c?Number(s.avg):0;
    var list=document.querySelector('.review-list');
    if(list) list.innerHTML=c?data.reviews.map(function(r){
      return '<div class="review-item"><div class="stars">'+stars(r.rating)+'</div><p>"'+esc(r.body)+'"</p><div class="ra">'+(r.verified?'<span class="verified">✓ Verified Buyer</span>':'')+'<span>'+esc(r.author)+(r.variant_label?' · '+esc(r.variant_label):'')+'</span></div></div>';
    }).join(''):'<p>No reviews yet — be the first.</p>';
    var big=document.querySelector('.rating-summary .big');if(big)big.textContent=c?avg.toFixed(1):'—';
    var sb=document.querySelector('.rating-summary .stars-big');if(sb)sb.textContent=c?stars(avg):'☆☆☆☆☆';
    var cnt=document.querySelector('.rating-summary .count');if(cnt)cnt.textContent='Based on '+c+' review'+(c===1?'':'s');
    var rows=document.querySelectorAll('.rating-summary .bar-row');
    [5,4,3,2,1].forEach(function(n,i){
      var row=rows[i];if(!row)return;
      var pct=c?Math.round((+s['s'+n]/c)*100):0;
      row.querySelector('.bar-fill').style.width=pct+'%';
      row.lastElementChild.textContent=pct+'%';
    });
    var rr=document.querySelector('.rating-row');
    if(rr)rr.innerHTML=c?'<span class="stars">'+stars(avg)+'</span> <a href="#reviews">'+avg.toFixed(1)+' · '+c+' reviews</a>':'<span class="stars">☆☆☆☆☆</span> <a href="#reviews">No reviews yet</a>';
  }
  function load(){
    fetch('/api/reviews?slug='+encodeURIComponent(slug)).then(function(r){return r.json();}).then(render).catch(function(){});
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(!rating){msg.textContent='Please choose a star rating.';return;}
    var fd=new FormData(form),btn=form.querySelector('button[type=submit]');
    btn.disabled=true;msg.textContent='Sending…';
    fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:slug,rating:rating,author:fd.get('author'),body:fd.get('body'),website:fd.get('website')})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(x){
      if(x.ok&&x.j.success){
        msg.textContent='Thanks! Your review is live.';form.reset();rating=0;paint();load();
        setTimeout(function(){document.getElementById('reviewFormWrap').open=false;},1500);
      } else msg.textContent=x.j.error||'Something went wrong.';
    })
    .catch(function(){msg.textContent='Network error. Try again.';})
    .then(function(){btn.disabled=false;});
  });
  document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
})();
