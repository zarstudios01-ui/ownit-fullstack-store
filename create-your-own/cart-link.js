(function () {
  var PRICE = 3500;
  var add = document.getElementById('cyoAddCart');
  if (!add) return;
  var id = null;
  document.addEventListener('cyo:saved', function (e) { id = e.detail; add.style.display = ''; });
  add.addEventListener('click', function () {
    if (!id || !window.OwnItCart) return;
    var pk = ((window.cyoPanels || []).filter(function (p) { return p.img; })[0] || { key: 'left' }).key;
    window.OwnItCart.addToCart({
      id: 'custom-skin', name: 'Custom Skin Set',
      variant: 'Custom design ' + id.slice(0, 8),
      price: PRICE, qty: 1, design_id: id,
      image: '/api/designs?id=' + id + '&panel=' + pk
    });
  });
})();
