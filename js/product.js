/* Product detail page */
(function () {
  "use strict";
  const FB = window.FB, CFG = window.FB_CONFIG;
  window.FB_page.on(async () => {
    const slug = new URLSearchParams(location.search).get("slug");
    const p = slug ? await FB.product(slug) : null;
    if (!p) {
      document.getElementById("pdp").innerHTML = `<div class="empty" style="grid-column:1/-1">Box not found. <a href="menu.html">Back to the menu</a></div>`;
      document.getElementById("reviewsSection").style.display = "none";
      return;
    }
    document.title = `${p.name} — ${CFG.BRAND}`;
    document.querySelector('meta[name="description"]').setAttribute("content", p.description.slice(0, 155));

    let qty = 1;
    const pdp = document.getElementById("pdp");
    pdp.innerHTML = `
      <div class="pdp-media"><img src="${p.image_url}" alt="${FB.esc(p.name)}" width="900" height="675" decoding="async"></div>
      <div class="pdp-info">
        ${p.categories?.name ? `<span class="badge badge-gold">${FB.esc(p.categories.name)}</span>` : ""}
        <h1>${FB.esc(p.name)}</h1>
        <div class="stars" id="pdpStars"></div>
        <div class="pdp-price">${FB.money(p.price)}</div>
        <p class="sub" style="font-size:1.02rem">${FB.esc(p.description)}</p>
        ${p.ingredients ? `<p class="sub" style="margin-top:14px;font-size:.88rem"><strong style="color:var(--ink)">Inside the box:</strong> ${FB.esc(p.ingredients)}</p>` : ""}
        <hr class="divider">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <div class="qty-stepper">
            <button id="qMinus" aria-label="Decrease">−</button><strong id="qVal">1</strong><button id="qPlus" aria-label="Increase">+</button>
          </div>
          <button class="btn btn-primary" id="pdpAdd" style="flex:1;min-width:180px">Add to basket — <span id="pdpAddTotal">${FB.money(p.price)}</span></button>
        </div>
        <p class="sub" style="margin-top:14px;font-size:.86rem">✓ Order by 10:30am for same-morning delivery · ✓ Gift note included · ✓ Pay with MoMo, card or cash</p>
      </div>`;
    document.getElementById("qMinus").onclick = () => { qty = Math.max(1, qty - 1); sync(); };
    document.getElementById("qPlus").onclick = () => { qty = Math.min(20, qty + 1); sync(); };
    function sync() {
      document.getElementById("qVal").textContent = qty;
      document.getElementById("pdpAddTotal").textContent = FB.money(p.price * qty);
    }
    document.getElementById("pdpAdd").onclick = () => {
      window.FB_Cart.add(p.id, qty);
      window.FB_toast(`${p.name} × ${qty} added to basket`);
    };

    /* reviews */
    const reviews = await FB.reviews(p.id);
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    document.getElementById("pdpStars").outerHTML =
      `<div style="display:flex;align-items:center;gap:10px;margin-top:6px">
        <span class="stars">${"★".repeat(Math.round(avg))}${"☆".repeat(5 - Math.round(avg))}</span>
        <span class="sub" style="font-size:.88rem">${avg.toFixed(1)} · ${reviews.length} review${reviews.length === 1 ? "" : "s"}</span></div>`;
    document.getElementById("reviewList").innerHTML = reviews.length
      ? reviews.map((r) => `
        <div class="review">
          <div class="rt"><b>${FB.esc(r.title || "Review")}</b><span class="stars" style="font-size:.9rem">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>
          <p class="sub">${FB.esc(r.body)}</p>
          <p style="font-size:.8rem;color:var(--ink-faint);margin-top:6px">${FB.esc(r.author_name)} · ${new Date(r.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
        </div>`).join("")
      : `<div class="empty">No reviews yet — be the first!</div>`;

    /* review form */
    let rating = 0;
    const starBtns = [...document.querySelectorAll("#rvStars button")];
    const paint = () => starBtns.forEach((b) => b.classList.toggle("on", +b.dataset.v <= rating));
    starBtns.forEach((b) => b.addEventListener("click", () => { rating = +b.dataset.v; paint(); }));
    document.getElementById("reviewForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!rating) return window.FB_toast("Pick a star rating first", true);
      try {
        await FB.addReview({
          product_id: p.id, author_name: document.getElementById("rvName").value.trim(),
          rating, title: document.getElementById("rvTitle").value.trim(),
          body: document.getElementById("rvBody").value.trim(),
        });
        window.FB_toast("Thank you! Your review is pending approval.");
        e.target.reset(); rating = 0; paint();
      } catch (err) { window.FB_toast(err.message || "Could not submit review", true); }
    });

    /* related */
    const all = await FB.products();
    const related = all.filter((x) => x.id !== p.id).slice(0, 3);
    document.getElementById("relatedGrid").innerHTML = related.map((x) => `
      <article class="card product-card">
        <a class="product-media" href="product.html?slug=${x.slug}">
          <img src="${x.image_url}" alt="${FB.esc(x.name)}" loading="lazy" decoding="async">
          <span class="price-tag">${FB.money(x.price)}</span>
        </a>
        <div class="product-body">
          <h3><a href="product.html?slug=${x.slug}">${FB.esc(x.name)}</a></h3>
          <p class="desc">${FB.esc(x.description)}</p>
          <button class="btn btn-primary btn-sm" data-add="${x.id}" style="align-self:flex-start">Add to basket</button>
        </div>
      </article>`).join("");
    document.querySelectorAll("#relatedGrid [data-add]").forEach((b) =>
      b.addEventListener("click", () => { window.FB_Cart.add(b.dataset.add, 1); window.FB_toast("Added to basket"); }));
  });
})();
