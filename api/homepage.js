const fs = require('fs');
const path = require('path');
const { getPool, cors } = require('./_db');

module.exports = async (req, res) => {
  if (cors(req, res)) return;

  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT slug, name, images, variants FROM products');

    const cardsHtml = rows.map(p => {
      const images = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
      const variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
      const img = images[0] || '/images/placeholder.jpg';
      const price = variants[0] ? variants[0].price : 0;

      return `
      <article class="product-card">
        <div class="product-media">
          <a href="/${p.slug}/">
            <img src="${img}" width="280" height="350" alt="${p.name} PS5 console skin" loading="lazy">
          </a>
          <button class="wishlist-btn" aria-label="Add ${p.name} skin to wishlist">♡</button>
          <button class="quick-add" data-add-to-cart data-id="${p.slug}" data-name="${p.name}" data-price="${price}" data-image="${img}">Quick Add</button>
        </div>
        <div class="product-info">
          <p class="compat">PS5 &amp; PS5 Slim</p>
          <h3><a href="/${p.slug}/">${p.name}</a></h3>
          <div class="product-meta">
            <span class="price">Rs. ${price}</span>
          </div>
        </div>
      </article>`;
    }).join('\n');

    const jsonLdItems = rows.map((p, i) => {
      const images = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
      const variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants;
      return {
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Product",
          "name": `${p.name} Skin`,
          "url": `https://www.ownit.com/${p.slug}/`,
          "image": (images[0] || ''),
          "offers": {
            "@type": "Offer",
            "priceCurrency": "PKR",
            "price": String(variants[0] ? variants[0].price : 0),
            "availability": "https://schema.org/InStock"
          }
        }
      };
    });

    const jsonLdHtml = `<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": jsonLdItems }, null, 2)}
</script>`;

    const templatePath = path.join(process.cwd(), 'home-template.html');
    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace('<!--PRODUCT_CARDS-->', cardsHtml);
    html = html.replace('<!--PRODUCT_JSONLD-->', jsonLdHtml);

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading homepage');
  }
};
