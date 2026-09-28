// api/product-page.js
const { getPool } = require('./_db');

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str = '', n = 155) {
  return str.length > n ? str.slice(0, n - 1).trim() + '…' : str;
}

function labelForImage(path) {
  const f = path.toLowerCase();
  if (f.includes('full')) return 'Console + Controller';
  if (f.includes('console')) return 'Console';
  if (f.includes('controller')) return 'Controller';
  if (f.includes('macro') && f.includes('badge')) return 'Badge Detail';
  if (f.includes('macro') && f.includes('edge')) return 'Edge Detail';
  if (f.includes('macro') && f.includes('material')) return 'Material Detail';
  if (f.includes('macro') && f.includes('angle')) return 'Angle Detail';
  if (f.includes('macro')) return 'Detail';
  return 'View';
}

function stars(rating) {
  const full = Math.round(rating);
  return '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
}

module.exports = async function handler(req, res) {
  const slug = (req.query.slug || '').toString();
  if (!slug) {
    res.status(400).send('Missing slug');
    return;
  }

  const pool = getPool();

  const [productRows] = await pool.query(
    'SELECT slug, name, description, images, variants, category, sku, badge, eyebrow, meta_keywords, related_slugs FROM products WHERE slug = ?',
    [slug]
  );

  if (!productRows.length) {
    res.status(404).send('<h1>Product not found</h1><p><a href="/">Back to OwnIt</a></p>');
    return;
  }

  const p = productRows[0];
  const images = typeof p.images === 'string' ? JSON.parse(p.images) : p.images || [];
  const variants = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants || [];
  const relatedSlugs = (typeof p.related_slugs === 'string' ? JSON.parse(p.related_slugs) : p.related_slugs) || [];

  const cardImage = images[0] || '/images/placeholder.jpg';
  const galleryImages = images.filter(f => !/accessory/i.test(f));
  const mainImage = galleryImages[0] || cardImage;
  const controllerImage = galleryImages.find(f => /controller/i.test(f)) || galleryImages[galleryImages.length - 1] || mainImage;

  const defaultVariant = variants[0] || { name: 'Console Only', price: 0 };
  const prices = variants.map(v => v.price);
  const lowPrice = Math.min(...prices, defaultVariant.price);
  const highPrice = Math.max(...prices, defaultVariant.price);

  // Reviews + rating summary
  const [reviewRows] = await pool.query(
    'SELECT author, rating, body, variant_label, verified, created_at FROM product_reviews WHERE product_slug = ? AND status = 'approved' ORDER BY created_at DESC',
    [slug]
  );
  const totalReviews = reviewRows.length;
  const avgRating = totalReviews
    ? reviewRows.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;
  const starCounts = [5, 4, 3, 2, 1].map(star => {
    const count = reviewRows.filter(r => r.rating === star).length;
    const pct = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
    return { star, pct };
  });

  // Related products
  let related = [];
  if (relatedSlugs.length) {
    const placeholders = relatedSlugs.map(() => '?').join(',');
    const [relRows] = await pool.query(
      `SELECT slug, name, images, variants FROM products WHERE slug IN (${placeholders})`,
      relatedSlugs
    );
    related = relatedSlugs
      .map(s => relRows.find(r => r.slug === s))
      .filter(Boolean)
      .map(r => {
        const rImages = typeof r.images === 'string' ? JSON.parse(r.images) : r.images || [];
        const rVariants = typeof r.variants === 'string' ? JSON.parse(r.variants) : r.variants || [];
        const rPrice = rVariants[0] ? rVariants[0].price : 0;
        return { slug: r.slug, name: r.name, image: rImages[0] || rImages[1] || '', price: rPrice };
      });
  }

  const galleryThumbsHtml = galleryImages
    .map(
      (img, i) => `
          <button class="gallery-thumb${i === 0 ? ' active' : ''}" data-img="${esc(img)}" data-label="${esc(labelForImage(img))}" role="tab" aria-selected="${i === 0}">
            <img src="${esc(img)}" width="200" height="200" alt="${esc(p.name)} ${esc(labelForImage(img))}" loading="lazy">
          </button>`
    )
    .join('');

  const coverageCardsHtml = variants
    .map(
      (v, i) => `
            <button class="coverage-card${i === 0 ? ' active' : ''}" data-coverage="${esc(v.name)}" data-price="${v.price}" data-img="${esc(mainImage)}">
              <div class="cc-title">${esc(v.name)}</div>
              <div class="cc-price">Rs. ${v.price.toLocaleString()}</div>
            </button>`
    )
    .join('');

  const relatedHtml = related
    .map(
      r => `
      <a class="rel-card" href="/${esc(r.slug)}/">
        <div class="rel-media"><img src="${esc(r.image)}" width="280" height="350" alt="${esc(r.name)} custom PS5 skin" loading="lazy"></div>
        <div class="rel-body"><h3>${esc(r.name)}</h3><span class="price">Rs. ${r.price.toLocaleString()}</span></div>
      </a>`
    )
    .join('');

  const reviewsListHtml = reviewRows
    .map(
      r => `
          <div class="review-item">
            <div class="stars">${stars(r.rating)}</div>
            <p>"${esc(r.body)}"</p>
            <div class="ra">${r.verified ? '<span class="verified">✓ Verified Buyer</span>' : ''}<span>${esc(r.author)}${r.variant_label ? ' · ' + esc(r.variant_label) : ''}</span></div>
          </div>`
    )
    .join('');

  const barRowsHtml = starCounts
    .map(
      s => `
          <div class="bar-row"><span>${s.star}★</span><div class="bar-track"><div class="bar-fill" style="width:${s.pct}%"></div></div><span>${s.pct}%</span></div>`
    )
    .join('');

  const jsonLdProduct = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: galleryImages,
    description: p.description,
    sku: p.sku || undefined,
    brand: { '@type': 'Brand', name: 'OwnIt' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'PKR',
      lowPrice: String(lowPrice),
      highPrice: String(highPrice),
      offerCount: String(variants.length),
      availability: 'https://schema.org/InStock'
    },
    ...(totalReviews
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            reviewCount: String(totalReviews)
          },
          review: reviewRows.map(r => ({
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: String(r.rating) },
            author: { '@type': 'Person', name: r.author },
            reviewBody: r.body
          }))
        }
      : {})
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.ownit.com/' },
      { '@type': 'ListItem', position: 2, name: 'Shop Skins', item: 'https://www.ownit.com/#collection' },
      { '@type': 'ListItem', position: 3, name: p.name, item: `https://www.ownit.com/${p.slug}/` }
    ]
  };

  const metaDesc = esc(truncate(p.description));
  const ratingRow = totalReviews
    ? `<span class="stars">${stars(avgRating)}</span>\n          <a href="#reviews">${avgRating.toFixed(1)} · ${totalReviews} reviews</a>`
    : `<span class="stars">☆☆☆☆☆</span>\n          <a href="#reviews">No reviews yet</a>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.name)} — Custom PS5 Skin | OwnIt</title>
<meta name="description" content="${metaDesc}">
<meta name="keywords" content="${esc(p.meta_keywords || `${p.name} PS5 skin, custom PS5 skin, PS5 controller skin, PS5 slim skin`)}">
<link rel="canonical" href="https://www.ownit.com/${esc(p.slug)}/">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#F2F1EC">

<meta property="og:type" content="product">
<meta property="og:site_name" content="OwnIt">
<meta property="og:title" content="${esc(p.name)} — Custom PS5 Skin | OwnIt">
<meta property="og:description" content="${metaDesc}">
<meta property="og:url" content="https://www.ownit.com/${esc(p.slug)}/">
<meta property="og:image" content="https://www.ownit.com${esc(mainImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.name)} — Custom PS5 Skin | OwnIt">
<meta name="twitter:image" content="https://www.ownit.com${esc(mainImage)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

<script type="application/ld+json">${JSON.stringify(jsonLdBreadcrumb)}</script>
<script type="application/ld+json">${JSON.stringify(jsonLdProduct)}</script>

<link rel="stylesheet" href="/style.css">
</head> 

<body data-product-slug="${esc(p.slug)}" data-product-name="${esc(p.name)}">
,.<header class="site-header">
  <div class="wrap header-inner">
    <a href="/" class="logo">Own<span>It</span></a>
    <nav class="main-nav" aria-label="Primary">
      <a href="/#collection">Shop Skins</a>
      <a href="/create-your-own/">Create Your Own</a>
      <a href="/#setup">Accessories</a>
      <a href="/#ugc">Gallery</a>
      <a href="/#why">About Us</a>
      <a href="/#footer">Contact</a>
    </nav>
    <div class="header-actions">
      <button class="icon-btn" aria-label="Search">Search</button>
      <button class="icon-btn" aria-label="Account">Account</button>
      <button class="icon-btn" aria-label="Cart, 0 items" data-cart-open>Cart<span class="cart-count">0</span></button>
    </div>
  </div>
</header>

<div class="cart-overlay" id="cartOverlay" data-cart-close></div>
<aside class="cart-drawer" id="cartDrawer" aria-label="Shopping cart">
  <div class="cart-drawer-head">
    <h2>Cart</h2>
    <button type="button" data-cart-close aria-label="Close cart">Close ✕</button>
  </div>
  <div class="cart-drawer-body" id="cartDrawerBody">
    <p class="cart-empty">Your cart is empty. <a href="/#collection">Shop the collection →</a></p>
  </div>
  <div class="cart-drawer-footer" id="cartDrawerFooter" style="display:none;">
    <div class="cart-subtotal-row"><span>Subtotal</span><span id="cartSubtotal">Rs. 0</span></div>
    <p class="cart-note">Shipping and taxes calculated at checkout.</p>
    <a href="/checkout/" class="btn btn-primary">Checkout</a>
  </div>
</aside>

<nav class="breadcrumb wrap" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/#collection">Shop Skins</a></li>
    <li>${esc(p.name)}</li>
  </ol>
</nav>

<main>
  <section class="pdp wrap" aria-label="Product details">
    <div class="pdp-grid">
      <div class="gallery">
        <div class="gallery-main">
          ${p.badge ? `<span class="gallery-badge">${esc(p.badge)}</span>` : ''}
          <img id="mainImage" src="${esc(mainImage)}" width="700" height="700" alt="${esc(p.name)} custom PS5 skin" loading="eager">
        </div>
        <div class="gallery-thumbs" role="tablist" aria-label="Product images">${galleryThumbsHtml}
        </div>
      </div>

      <div class="pdp-info">
        ${p.eyebrow ? `<span class="eyebrow">${esc(p.eyebrow)}</span>` : ''}
        <h1>${esc(p.name)}</h1>
        <div class="rating-row">
          ${ratingRow}
        </div>
        <div class="price-row">
          <span class="price" id="priceDisplay">Rs. ${defaultVariant.price.toLocaleString()}</span>
          <span class="price-note">PKR · Free tracked shipping</span>
        </div>
        <p class="pdp-desc">${esc(p.description)}</p>

        <div class="option-group">
          <div class="label"><span>Console Model</span><span id="modelSelected">PS5 Disc</span></div>
          <div class="pill-row" id="modelPills">
            <button class="pill active" data-model="PS5 Disc">PS5 Disc</button>
            <button class="pill" data-model="PS5 Digital">PS5 Digital</button>
            <button class="pill" data-model="PS5 Slim">PS5 Slim</button>
          </div>
        </div>

        <div class="option-group">
          <div class="label"><span>Coverage</span><span id="coverageSelected">${esc(defaultVariant.name)}</span></div>
          <div class="coverage-row" id="coveragePills">${coverageCardsHtml}
          </div>
        </div>

        <div class="qty-add">
          <div class="qty-stepper">
            <button id="qtyMinus" aria-label="Decrease quantity">−</button>
            <span id="qtyValue">1</span>
            <button id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary" id="addToCartBtn">Add To Cart</button>
        </div>

        <p class="meta-line">SKU: ${esc(p.sku || '—')} · In stock · Ships within 2 business days</p>

        <div class="trust-row">
          <span class="ti"><span class="dot"></span>Precision fit, PS5 &amp; Slim</span>
          <span class="ti"><span class="dot"></span>Air-release adhesive</span>
          <span class="ti"><span class="dot"></span>30-day returns</span>
        </div>
      </div>
    </div>
  </section>

  <div class="sticky-bar" id="stickyBar">
    <div class="wrap sticky-inner">
      <span class="si-name">${esc(p.name)}</span>
      <span class="si-price" id="stickyPrice">Rs. ${defaultVariant.price.toLocaleString()}</span>
      <button class="btn btn-primary" id="stickyAddBtn">Add To Cart</button>
    </div>
  </div>

  <section class="details" aria-label="Product details and specifications">
    <h2>The Details</h2>
    <details class="acc-item" open>
      <summary>Material &amp; Fit</summary>
      <div class="acc-body">
        <div class="spec-row"><span class="k">Material</span><span class="v">Cast vinyl, 3M-grade</span></div>
        <div class="spec-row"><span class="k">Finish</span><span class="v">Matte laminate, anti-glare</span></div>
        <div class="spec-row"><span class="k">Thickness</span><span class="v">0.15mm</span></div>
        <div class="spec-row"><span class="k">Cut tolerance</span><span class="v">±0.3mm around ports &amp; vents</span></div>
        <div class="spec-row"><span class="k">Compatibility</span><span class="v">PS5 Disc, PS5 Digital, PS5 Slim</span></div>
      </div>
    </details>
    <details class="acc-item">
      <summary>Application &amp; Care</summary>
      <div class="acc-body">
        <p>Clean the panel, align using the edge guides, then squeegee from the center outward to push out air. Most installs take under 10 minutes. Full instructions and an application video ship with every order. Removes cleanly by hand with no residue.</p>
      </div>
    </details>
    <details class="acc-item">
      <summary>Shipping &amp; Returns</summary>
      <div class="acc-body">
        <p>Standard orders ship within 2 business days with tracked delivery. Premade designs like this one qualify for our standard 30-day return policy in original condition. Damaged or misprinted orders are replaced free of charge.</p>
      </div>
    </details>
  </section>

  <section class="crosssell" aria-label="Add the matching controller">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Complete the setup</span>
        <h2>Add The Controller</h2>
        <p>Already getting the console skin above? Add the matching controller skin separately for Rs. 500.</p>
      </div>
      <div class="bundle-grid" style="grid-template-columns:minmax(260px,360px);">
        <div class="bundle-card included">
          <div class="bundle-media"><img src="${esc(controllerImage)}" width="360" height="270" alt="${esc(p.name)} DualSense controller skin" loading="lazy"></div>
          <div class="bundle-body"><h3>${esc(p.name)} Controller Skin</h3><span class="bp">Rs. 500</span></div>
        </div>
      </div>
      <div class="bundle-cta">
        <button class="btn btn-primary" id="bundleAddBtn" data-img="${esc(controllerImage)}">Add Controller Skin — Rs. 500</button>
      </div>
    </div>
  </section>

  ${related.length ? `<section class="related wrap" aria-label="You might also like">
    <div class="section-head">
      <span class="eyebrow">Keep browsing</span>
      <h2>You Might Also Like</h2>
    </div>
    <div class="related-grid">${relatedHtml}
    </div>
  </section>` : ''}

  <section class="pdp-reviews" id="reviews" aria-label="Customer reviews">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">Customer reviews</span>
        <h2>What Players Say</h2>
      </div>
      <details class="review-form-wrap" id="reviewFormWrap">
        <summary>Write a review</summary>
        <form id="reviewForm" novalidate>
          <div class="star-input" id="starInput" role="radiogroup" aria-label="Your rating">
            <button type="button" data-v="1" aria-label="1 star">★</button>
            <button type="button" data-v="2" aria-label="2 stars">★</button>
            <button type="button" data-v="3" aria-label="3 stars">★</button>
            <button type="button" data-v="4" aria-label="4 stars">★</button>
            <button type="button" data-v="5" aria-label="5 stars">★</button>
          </div>
          <input type="text" name="author" placeholder="Your name" maxlength="40" required>
          <textarea name="body" placeholder="Share your experience" maxlength="600" required></textarea>
          <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
          <button type="submit" class="review-submit">Submit review</button>
          <p class="form-msg" id="reviewMsg"></p>
        </form>
      </details>
      <div class="reviews-layout">
        <div class="rating-summary">
          <div class="big">${totalReviews ? avgRating.toFixed(1) : '—'}</div>
          <div class="stars-big">${totalReviews ? stars(avgRating) : '☆☆☆☆☆'}</div>
          <div class="count">Based on ${totalReviews} review${totalReviews === 1 ? '' : 's'}</div>${barRowsHtml}
        </div>
        <div class="review-list">${reviewsListHtml || '<p>No reviews yet — be the first.</p>'}
        </div>
      </div>
    </div>
  </section>

  <section class="final-cta" aria-label="Final call to action">
    <h2>MAKE IT YOURS.</h2>
    <p>Not the one? Browse the full collection or design something entirely your own.</p>
    <div class="final-ctas">
      <a href="/#collection" class="btn btn-primary">Shop All Skins</a>
      <a href="/create-your-own/" class="btn btn-ghost">Create Your Own</a>
    </div>
  </section>
</main>

<footer class="site-footer" id="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="logo">Own<span style="color:var(--blood);">It</span></a>
        <p style="color:var(--graphite);font-size:13.5px;max-width:260px;margin-top:14px;">Premium custom PS5 skins, precision-cut and made to change with you.</p>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <ul>
          <li><a href="/#collection">PS5 Skins</a></li>
          <li><a href="/#collection">PS5 Slim Skins</a></li>
          <li><a href="/#setup">Controller Skins</a></li>
          <li><a href="/#setup">Accessories</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Custom</h4>
        <ul>
          <li><a href="/create-your-own/">Create Your Own</a></li>
          <li><a href="/#customizer">How It Works</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Help</h4>
        <ul>
          <li><a href="/#footer">Contact</a></li>
          <li><a href="/#faq">FAQ</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="/#why">About</a></li>
          <li><a href="/#ugc">Gallery</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 OwnIt. All rights reserved.</p>
      <p><a href="/#footer">Privacy</a> · <a href="/#footer">Terms</a></p>
    </div>
  </div>
</footer>

<script src="/js/cart.js"></script>
<script src="/js/assistant.js"></script>
<script src="/js/product-page.js" defer></script>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

