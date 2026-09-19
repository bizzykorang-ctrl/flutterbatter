/* Homepage rendering: featured, best sellers, testimonials, stats,
   coverage map, FAQ, instagram, footer. Runs before app.js's DOMContentLoaded
   handlers? No — both listen; this one is registered first, so it runs first. */
(function () {
  "use strict";
  const CFG = window.FB_CONFIG, FB = window.FB;
  const $ = (s) => document.querySelector(s);
  const esc = FB.esc;

  function productCard(p) {
    const cat = p.categories?.name;
    return `
      <article class="card product-card">
        <a class="product-media" href="product.html?slug=${p.slug}" aria-label="${esc(p.name)}">
          <img src="${p.image_url}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="640" height="480">
          <span class="price-tag">${FB.money(p.price)}</span>
          ${p.is_best_seller ? '<span class="badge badge-ink" style="position:absolute;top:12px;left:12px">Best seller</span>' : ""}
        </a>
        <div class="product-body">
          ${cat ? `<span class="badge badge-gold" style="align-self:flex-start">${esc(cat)}</span>` : ""}
          <h3><a href="product.html?slug=${p.slug}">${esc(p.name)}</a></h3>
          <p class="desc">${esc(p.description)}</p>
          <div style="display:flex;gap:10px;align-items:center">
            <button class="btn btn-primary btn-sm" style="flex:1" data-add="${p.id}">Add to basket</button>
            <a class="btn btn-ghost btn-sm" href="product.html?slug=${p.slug}">Details</a>
          </div>
        </div>
      </article>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const [settings, featured, best, reviews] = await Promise.all([
        FB.settings(), FB.products({ featured: true }), FB.products({ bestSeller: true }), FB.featuredReviews(),
      ]);
      const hp = settings.homepage || {};

      /* honor admin section toggles: hide sections switched off */
      const secMap = { hero: "hero", featured: "featured", best_sellers: "bestSellers",
        how_it_works: "howItWorks", testimonials: "testimonials", stats: "stats",
        coverage_map: "coverage", faq: "faq", instagram: "instagram", cta: "cta" };
      const sections = hp.sections || {};
      Object.keys(secMap).forEach(function (key) {
        const el = document.getElementById(secMap[key]);
        if (el && sections[key] === false) el.style.display = "none";
      });

      /* hero words animation */
      const h = $("#heroHeading");
      if (h) {
        h.innerHTML = (hp.hero_heading || h.textContent).split(" ")
          .map((w, i) => `<span class="w" style="animation-delay:${0.12 + i * 0.09}s">${esc(w)}</span>`).join(" ");
        if (hp.hero_sub) $("#heroSub").textContent = hp.hero_sub;
      }

      /* marquee */
      const mt = $("#marqueeTrack");
      if (mt) {
        const items = ["Warm pancakes", "Gift-wrapped", "Folded omelettes", "Ribbon-finished", "Delivered across Accra", "Order by 10:30am"];
        mt.innerHTML = [...items, ...items].map((t) => `<span>✦ ${t}</span>`).join("");
      }

      /* featured + best sellers */
      const fg = $("#featuredGrid"), bg = $("#bestSellerGrid");
      if (fg) {
        fg.innerHTML = featured.map(productCard).join("");
        fg.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
          window.FB_Cart.add(b.dataset.add, 1);
          window.FB_toast("Added to basket");
        }));
      }
      if (bg) {
        const list = best.length ? best : featured;
        bg.innerHTML = list.map(productCard).join("");
        bg.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
          window.FB_Cart.add(b.dataset.add, 1);
          window.FB_toast("Added to basket");
        }));
      }

      /* testimonials */
      const tg = $("#testimonialGrid");
      if (tg && reviews.length) {
        tg.innerHTML = reviews.map((r) => `
          <div class="card quote-card">
            <div class="stars" aria-label="${r.rating} out of 5">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
            <p class="body">“${esc(r.body)}”</p>
            <div class="who">${esc(r.author_name)} <span>· verified order</span></div>
          </div>`).join("");
      }

      /* stats (animated counters) */
      const sb = $("#statsBand");
      if (sb) {
        const s = settings.stats || {};
        const stats = [
          [s.boxes_delivered || 0, "boxes delivered", ""],
          [s.gift_wrapped || 0, "gift-wrapped with ribbon", ""],
          [s.avg_rating || 4.8, "average rating", ""],
          [s.areas_covered || 12, "areas covered in Accra", ""],
        ];
        sb.innerHTML = stats.map(([n, label], i) => `
          <div><div class="stat-num" data-count="${n}" data-dec="${String(n).includes(".") ? 1 : 0}">0</div>
          <div class="stat-label">${label}</div></div>`).join("");
        const io = new IntersectionObserver((es) => {
          es.forEach((e) => {
            if (!e.isIntersecting) return;
            io.unobserve(e.target);
            e.target.querySelectorAll("[data-count]").forEach((el) => {
              const target = parseFloat(el.dataset.count), dec = +el.dataset.dec;
              const t0 = performance.now(), dur = 1400;
              (function tick(t) {
                const k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 3);
                el.textContent = (target * ease).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "" : "+");
                if (k < 1) requestAnimationFrame(tick);
              })(t0);
            });
          });
        }, { threshold: .4 });
        io.observe(sb);
      }

      /* coverage map + zones */
      const zones = settings.delivery?.zones || [];
      const mz = $("#mapZones");
      if (mz && zones.length) {
        const pts = zones.map((z, i) => {
          const angle = (i / zones.length) * Math.PI * 2 - Math.PI / 2;
          const r = 78 + (i % 2) * 34;
          return { x: 210 + r * Math.cos(angle) * 1.25, y: 168 + r * Math.sin(angle) * .8, ...z };
        });
        mz.innerHTML = pts.map((p) => `
          <g>
            <circle class="zone-ring" cx="${p.x}" cy="${p.y}" r="17"/>
            <circle class="zone-dot" cx="${p.x}" cy="${p.y}" r="5"/>
            <text x="${p.x}" y="${p.y - 13}" text-anchor="middle">${esc(p.name)}</text>
          </g>`).join("");
      }
      const zl = $("#zoneList");
      if (zl) {
        zl.innerHTML = zones.map((z) => `
          <div class="zone-row"><span>${esc(z.name)} <span class="sub" style="font-size:.8rem">· ${esc(z.eta)}</span></span>
          <span class="zone-fee">${FB.money(z.fee)}</span></div>`).join("");
      }
      if ($("#coverageHours")) $("#coverageHours").textContent = `Delivery ${settings.delivery?.hours || ""} · ${settings.delivery?.note || ""}`;
      if ($("#coverageNote")) $("#coverageNote").textContent = settings.delivery?.note || "";

      /* FAQ accordion */
      const fl = $("#faqList");
      if (fl) {
        fl.innerHTML = (settings.faq || []).slice(0, 5).map((f) => `
          <div class="faq-item">
            <button class="faq-q">${esc(f.q)} <span class="tw">+</span></button>
            <div class="faq-a"><p>${esc(f.a)}</p></div>
          </div>`).join("");
        fl.querySelectorAll(".faq-item").forEach((item) => {
          item.querySelector(".faq-q").addEventListener("click", () => {
            const open = item.classList.contains("open");
            fl.querySelectorAll(".faq-item").forEach((x) => x.classList.remove("open"));
            if (!open) item.classList.add("open");
          });
        });
      }

      /* instagram grid — real product shots (swap for IG embeds/CDN later) */
      const ig = $("#instaGrid");
      if (ig) {
        const shots = ["assets/img/pancake.jpg", "assets/img/classic.jpg", "assets/img/fusion.jpg",
                       "assets/img/classic.jpg", "assets/img/pancake.jpg", "assets/img/fusion.jpg"];
        ig.innerHTML = shots.map((src) => `
          <a class="insta-cell" href="${settings.site?.instagram || CFG.INSTAGRAM}" target="_blank" rel="noopener" aria-label="Instagram">
            <img src="${src}" alt="Flutter Batter box" loading="lazy" decoding="async">
            <span class="ig">◈</span>
          </a>`).join("");
      }

      /* footer (shared across pages via home.js only on index; others use page.js) */
      renderFooter(settings);
    } catch (e) {
      console.error("home render:", e);
    }
  });

  function renderFooter(settings) {
    const f = document.getElementById("siteFooter");
    if (!f) return;
    f.innerHTML = `
      <div class="wrap footer-grid">
        <div>
          <div class="brand" style="color:var(--paper)"><span class="spark">✦</span>${CFG.BRAND}</div>
          <p style="margin-top:12px;font-size:.92rem;max-width:300px">${esc(settings.site?.tagline || "Breakfast boxes, gift-wrapped. Delivered warm across Accra.")}</p>
          <p style="margin-top:14px;font-size:.9rem"><a href="https://wa.me/${settings.site?.whatsapp || CFG.WHATSAPP}" target="_blank" rel="noopener">WhatsApp ${settings.site?.whatsapp || CFG.WHATSAPP}</a></p>
        </div>
        <div>
          <h4>Explore</h4>
          <a href="menu.html">Menu</a><a href="about.html">About us</a>
          <a href="delivery.html">Delivery info</a><a href="track.html">Track order</a>
        </div>
        <div>
          <h4>Support</h4>
          <a href="faq.html">FAQ</a><a href="contact.html">Contact</a>
          <a href="account.html">My account</a><a href="account.html">Order history</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of service</a>
          <a href="${settings.site?.instagram || CFG.INSTAGRAM}" target="_blank" rel="noopener">Instagram</a>
        </div>
      </div>
      <div class="wrap footer-bottom">
        <span>© ${new Date().getFullYear()} ${CFG.BRAND}. Made with butter in Accra.</span>
        <span>Paystack · MTN MoMo · Vodafone Cash · Cash on delivery</span>
      </div>`;
  }
  window.FB_renderFooter = renderFooter;
})();
