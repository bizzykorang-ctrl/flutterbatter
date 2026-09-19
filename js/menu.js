/* Menu page: search + category filter */
(function () {
  "use strict";
  const FB = window.FB;
  window.FB_page.on(async () => {
    const grid = document.getElementById("menuGrid");
    const emptyEl = document.getElementById("menuEmpty");
    const searchEl = document.getElementById("menuSearch");
    const chipsEl = document.getElementById("catChips");
    let cats = [], all = [], activeCat = "all", query = "";

    const card = (p) => {
      const cat = p.categories?.name;
      return `
        <article class="card product-card">
          <a class="product-media" href="product.html?slug=${p.slug}">
            <img src="${p.image_url}" alt="${FB.esc(p.name)}" loading="lazy" decoding="async" width="640" height="480">
            <span class="price-tag">${FB.money(p.price)}</span>
            ${p.is_best_seller ? '<span class="badge badge-ink" style="position:absolute;top:12px;left:12px">Best seller</span>' : ""}
          </a>
          <div class="product-body">
            ${cat ? `<span class="badge badge-gold" style="align-self:flex-start">${FB.esc(cat)}</span>` : ""}
            <h3><a href="product.html?slug=${p.slug}">${FB.esc(p.name)}</a></h3>
            <p class="desc">${FB.esc(p.description)}</p>
            <div style="display:flex;gap:10px;align-items:center">
              <button class="btn btn-primary btn-sm" style="flex:1" data-add="${p.id}">Add to basket</button>
              <a class="btn btn-ghost btn-sm" href="product.html?slug=${p.slug}">Details</a>
            </div>
          </div>
        </article>`;
    };

    function render() {
      let list = all;
      if (activeCat !== "all") {
        const c = cats.find((x) => x.slug === activeCat);
        list = list.filter((p) => (p.categories?.slug || p.category_id) === (c?.id ?? activeCat) || p.categories?.slug === activeCat);
      }
      if (query) list = list.filter((p) => (p.name + " " + p.description).toLowerCase().includes(query.toLowerCase()));
      grid.innerHTML = list.map(card).join("");
      emptyEl.style.display = list.length ? "none" : "block";
      grid.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
        window.FB_Cart.add(b.dataset.add, 1);
        window.FB_toast("Added to basket");
      }));
    }

    cats = await FB.categories();
    all = await FB.products();
    chipsEl.innerHTML = [`<button class="chip on" data-cat="all">All boxes</button>`]
      .concat(cats.map((c) => `<button class="chip" data-cat="${c.slug}">${FB.esc(c.name)}</button>`)).join("");
    chipsEl.querySelectorAll("[data-cat]").forEach((chip) => chip.addEventListener("click", () => {
      chipsEl.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
      chip.classList.add("on");
      activeCat = chip.dataset.cat;
      render();
    }));
    searchEl.addEventListener("input", () => { query = searchEl.value.trim(); render(); });
    render();
  });
})();
