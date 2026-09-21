/* Flutter Batter — shared app shell: header, cart drawer, toasts,
   reveal-on-scroll, auth state, WhatsApp float. Loaded on every page
   after config.js + data.js. */
(function () {
  "use strict";
  const CFG = window.FB_CONFIG, FB = window.FB;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  /* ---------- cart (localStorage) ---------- */
  const Cart = {
    items: (() => { try { return JSON.parse(localStorage.getItem("fb_cart")) || {}; } catch { return {}; } })(),
    save() { localStorage.setItem("fb_cart", JSON.stringify(this.items)); },
    add(id, qty) { this.items[id] = (this.items[id] || 0) + qty; this.save(); this.render(); },
    set(id, qty) { if (qty <= 0) delete this.items[id]; else this.items[id] = qty; this.save(); this.render(); },
    count() { return Object.values(this.items).reduce((a, b) => a + b, 0); },
    clear() { this.items = {}; this.save(); this.render(); },
    render() {
      $$(".cart-count").forEach((el) => {
        const c = this.count();
        el.textContent = c;
        el.classList.toggle("on", c > 0);
        el.classList.remove("pop"); void el.offsetWidth; if (c > 0) el.classList.add("pop");
      });
      renderDrawer();
    },
  };
  window.FB_Cart = Cart;

  /* ---------- toast ---------- */
  function toast(msg, err) {
    let zone = $(".toast-zone");
    if (!zone) { zone = document.createElement("div"); zone.className = "toast-zone"; document.body.appendChild(zone); }
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : "");
    t.textContent = msg;
    zone.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".4s"; setTimeout(() => t.remove(), 400); }, 2600);
  }
  window.FB_toast = toast;

  /* ---------- header ---------- */
  const NAV = [
    ["Home", "index.html"], ["Menu", "menu.html"], ["Track Order", "track.html"],
    ["About", "/about.html"], ["Delivery", "/delivery.html"], ["FAQ", "faq.html"], ["Contact", "/contact.html"],
  ];
  function renderHeader() {
    const here = location.pathname.split("/").pop() || "index.html";
    $("#siteHeader").innerHTML = `
      <div class="wrap header-in">
        <a class="brand" href="index.html"><span class="spark">✦</span>${CFG.BRAND}</a>
        <nav class="nav" id="mainNav">${NAV.map(([label, href]) =>
          `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
          <a href="account.html" id="navAccount">Account</a>
        </nav>
        <div class="header-actions">
          <a class="icon-btn" href="account.html" id="acctIcon" aria-label="Account">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
          </a>
          <button class="icon-btn" id="cartBtn" aria-label="Basket">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 7h12l1.5 12.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
            <span class="cart-count">0</span>
          </button>
          <button class="menu-toggle" id="menuToggle" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>`;
    $("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("nav-open"));
    $("#cartBtn").addEventListener("click", openDrawer);
  }

  /* ---------- cart drawer ---------- */
  async function renderDrawer() {
    const body = $("#drawerBody"); if (!body) return;
    const entries = Object.entries(Cart.items);
    if (!entries.length) {
      body.innerHTML = `<div class="empty">Your basket is empty.<br><br><a class="btn btn-primary btn-sm" href="menu.html">Browse the menu</a></div>`;
    } else {
      const products = await FB.products();
      let html = "";
      for (const [id, qty] of entries) {
        const p = products.find((x) => x.id === id) || products.find((x) => x.slug === id);
        if (!p) continue;
        html += `
          <div class="cart-line" data-id="${p.id}">
            <img src="${p.image_url}" alt="${FB.esc(p.name)}" loading="lazy">
            <div>
              <div class="nm">${FB.esc(p.name)}</div>
              <div class="qty-row">
                <button class="dec" aria-label="Decrease">−</button><span>${qty}</span><button class="inc" aria-label="Increase">+</button>
              </div>
            </div>
            <strong>${FB.money(p.price * qty)}</strong>
          </div>`;
      }
      body.innerHTML = html;
      $$(".cart-line", body).forEach((line) => {
        const id = line.dataset.id;
        line.querySelector(".dec").onclick = () => Cart.set(id, (Cart.items[id] || 0) - 1);
        line.querySelector(".inc").onclick = () => Cart.set(id, (Cart.items[id] || 0) + 1);
      });
    }
    // totals
    const products = await FB.products();
    const subtotal = Object.entries(Cart.items).reduce((s, [id, qty]) => {
      const p = products.find((x) => x.id === id); return s + (p ? p.price * qty : 0);
    }, 0);
    const n = Cart.count();
    $("#drawerSubtotal").textContent = FB.money(subtotal);
    $("#drawerCount").textContent = n ? `${n} item${n > 1 ? "s" : ""}` : "—";
    $("#drawerCheckout").disabled = !n;
  }
  function openDrawer() { $("#cartDrawer").classList.add("open"); $("#drawerVeil").classList.add("open"); renderDrawer(); }
  function closeDrawer() { $("#cartDrawer").classList.remove("open"); $("#drawerVeil").classList.remove("open"); }

  /* ---------- reveal on scroll ---------- */
  function setupReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal, .stagger").forEach((el) => io.observe(el));
  }

  /* ---------- auth header state ---------- */
  async function refreshAccountUI() {
    const user = await FB.user();
    const label = user ? (user.email || "Account") : "Account";
    const nav = $("#navAccount"); if (nav) nav.textContent = label;
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    renderHeader();
    // drawer + veil + wa float scaffolding
    const veil = document.createElement("div"); veil.className = "drawer-veil"; veil.id = "drawerVeil";
    const drawer = document.createElement("aside"); drawer.className = "drawer"; drawer.id = "cartDrawer";
    drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-label", "Basket");
    drawer.innerHTML = `
      <div class="drawer-head"><h3>Your basket</h3><button class="icon-btn" id="drawerClose" aria-label="Close">✕</button></div>
      <div class="drawer-body" id="drawerBody"></div>
      <div class="drawer-foot">
        <div class="row"><span class="sub" id="drawerCount">—</span><span id="drawerSubtotal">${CFG.CURRENCY}0</span></div>
        <a class="btn btn-primary" id="drawerCheckout" href="checkout.html" style="width:100%">Checkout</a>
        <button class="btn btn-ghost btn-sm" id="drawerClear" style="width:100%;margin-top:8px">Clear basket</button>
      </div>`;
    const wa = document.createElement("a");
    wa.className = "wa-float"; wa.target = "_blank"; wa.rel = "noopener";
    wa.href = `https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent("Hi " + CFG.BRAND + "! I have a question about your boxes.")}`;
    wa.setAttribute("aria-label", "WhatsApp support");
    wa.innerHTML = `<svg viewBox="0 0 32 32"><path d="M16 3C9.4 3 4 8.4 4 15c0 2.6.8 5 2.3 7L4 29l7.2-2.2c1.9 1 4 1.6 6.3 1.6h.5c6.6 0 12-5.4 12-12S22.6 3 16 3zm7 17c-.3.8-1.7 1.6-2.4 1.7-.6.1-1.4.1-2.2-.1-.5-.2-1.2-.4-2-.8-3.5-1.5-5.8-5-6-5.3-.2-.2-1.4-1.9-1.4-3.6 0-1.7.9-2.6 1.2-2.9.3-.3.7-.4 1-.4h.7c.2 0 .5-.1.8.6.3.8 1.1 2.6 1.2 2.8.1.2.2.4 0 .7-.1.3-.2.4-.4.7l-.6.7c-.2.2-.4.4-.2.8.2.4 1 1.7 2.2 2.7 1.5 1.4 2.8 1.8 3.2 2 .4.2.6.2.9-.1.2-.3 1-1.2 1.3-1.6.3-.4.5-.3.9-.2.4.1 2.2 1 2.6 1.2.4.2.6.3.7.5.1.1.1.9-.2 1.6z"/></svg>`;
    document.body.append(veil, drawer, wa);
    veil.addEventListener("click", closeDrawer);
    $("#drawerClear").addEventListener("click", function () { Cart.clear(); toast("Basket cleared"); closeDrawer(); });
    $("#drawerClose").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
    Cart.render();
    setupReveal();
    await refreshAccountUI();
    FB.onAuth(() => refreshAccountUI());

    // demo-mode banner for the builder/owner (never shows to real visitors once keys are set)
    if (!CFG.LIVE) {
      const b = document.createElement("div");
      b.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:75;background:#2B1B12;color:#F7C948;font:700 11px/1.4 sans-serif;padding:7px 12px;border-radius:9px;opacity:.92";
      b.textContent = "DEMO MODE — sample data, no live payments";
      document.body.appendChild(b);
    }

    // PWA service worker (https only)
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js?v=3").catch(() => {});
    }

    // OneSignal (https only, live mode only)
    if (CFG.LIVE && location.protocol === "https:" && CFG.ONESIGNAL_APP_ID) {
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.defer = true;
      document.head.appendChild(s);
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try { await OneSignal.init({ appId: CFG.ONESIGNAL_APP_ID }); } catch {}
      });
    }
  });
})();
