/* Checkout: totals, coupon validation, zone fee, order placement,
   Paystack inline (live) / demo confirmation (demo mode). */
(function () {
  "use strict";
  const FB = window.FB, CFG = window.FB_CONFIG;
  window.FB_page.on(async () => {
    const settings = await FB.settings();
    const zones = settings.delivery?.zones || [];
    const products = await FB.products();
    const entries = Object.entries(window.FB_Cart.items);
    if (!entries.length) {
      document.getElementById("checkoutRoot").innerHTML =
        `<div class="card empty" style="padding:60px 20px">Your basket is empty.<br><br><a class="btn btn-primary" href="menu.html">Browse the menu</a></div>`;
      return;
    }

    const items = entries.map(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      return { product_id: p.id, slug: p.slug, name: p.name, price: p.price, qty, image: p.image_url };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

    /* payment method */
    let payMethod = "paystack";
    document.querySelectorAll("#payMethods .chip").forEach((c) => c.addEventListener("click", () => {
      document.querySelectorAll("#payMethods .chip").forEach((x) => x.classList.remove("on"));
      c.classList.add("on"); payMethod = c.dataset.pay;
    }));

    /* zones */
    const zoneSel = document.getElementById("coZone");
    zoneSel.innerHTML = zones.map((z, i) =>
      `<option value="${i}">${z.name} — ${FB.money(z.fee)} · ${z.eta}</option>`).join("");

    /* coupon */
    let coupon = null;
    const couponMsg = document.getElementById("coCouponMsg");
    document.getElementById("coCouponBtn").addEventListener("click", async () => {
      const code = document.getElementById("coCoupon").value.trim();
      couponMsg.textContent = ""; couponMsg.style.color = "";
      if (!code) return;
      const res = await FB.checkCoupon(code, subtotal);
      if (res.ok) {
        coupon = res; couponMsg.textContent = `✓ ${res.label} applied (−${FB.money(res.discount)})`;
        couponMsg.style.color = "var(--green)";
      } else {
        coupon = null; couponMsg.textContent = `✕ ${res.reason}`; couponMsg.style.color = "var(--red)";
      }
      renderTotals();
    });

    /* lines + totals */
    document.getElementById("coLines").innerHTML = items.map((i) => `
      <div style="display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;padding:9px 0">
        <img src="${i.image}" alt="" style="width:48px;height:48px;border-radius:9px;object-fit:cover">
        <div><b style="font-size:.92rem">${FB.esc(i.name)}</b><div class="sub" style="font-size:.8rem">× ${i.qty}</div></div>
        <strong>${FB.money(i.price * i.qty)}</strong>
      </div>`).join("");

    function currentZone() { return zones[+zoneSel.value] || zones[0]; }
    function renderTotals() {
      const z = currentZone();
      const discount = coupon ? coupon.discount : 0;
      const total = subtotal + (z?.fee || 0) - discount;
      document.getElementById("coTotals").innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="sub">Subtotal</span><span>${FB.money(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="sub">Delivery — ${FB.esc(z?.name || "")}</span><span>${FB.money(z?.fee || 0)}</span></div>
        ${discount ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:var(--green)"><span>Coupon ${coupon.code}</span><span>−${FB.money(discount)}</span></div>` : ""}
        <hr class="divider" style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;font-family:var(--font-display);font-size:1.35rem;font-weight:700"><span>Total</span><span>${FB.money(total)}</span></div>`;
      return total;
    }
    zoneSel.addEventListener("change", renderTotals);
    renderTotals();

    /* prefill for signed-in users */
    const user = await FB.user();
    if (user) document.getElementById("coEmail").value = user.email || "";
    const addrs = await FB.addresses();
    const def = addrs.find((a) => a.is_default) || addrs[0];
    if (def) {
      document.getElementById("coStreet").value = def.street || "";
      const zi = zones.findIndex((z) => z.name === def.area);
      if (zi >= 0) zoneSel.value = zi;
    }

    /* submit */
    document.getElementById("coForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("coSubmit");
      btn.disabled = true; btn.textContent = "Placing order…";
      try {
        const total = renderTotals();
        const res = await FB.placeOrder({
          customer: {
            name: document.getElementById("coName").value.trim(),
            phone: document.getElementById("coPhone").value.trim(),
            email: document.getElementById("coEmail").value.trim(),
            street: document.getElementById("coStreet").value.trim(),
            notes: document.getElementById("coNote").value.trim(),
          },
          items, zone: currentZone(), couponCode: coupon?.code || null,
          paymentMethod: payMethod, note: document.getElementById("coNote").value.trim(),
        });
        const order = res.order;

        if (payMethod === "cash") {
          finish(order, null);
        } else if (res.demo || !CFG.LIVE) {
          // demo mode: simulate a paid order so the flow is testable end to end
          order.payment_status = "paid";
          try {
            const stored = JSON.parse(localStorage.getItem("fb_orders") || "[]");
            const rec = stored.find((x) => x.id === order.id);
            if (rec) { rec.payment_status = "paid"; localStorage.setItem("fb_orders", JSON.stringify(stored)); }
          } catch {}
          finish(order, null);
        } else {
          // live mode: the paystack-init edge function re-prices the order
          // server-side (never trusts client amounts) and returns a hosted
          // payment URL for MoMo/card.
          const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/paystack-init`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
              order_id: order.id,
              items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
            }),
          });
          const init = await r.json();
          if (!init.authorization_url) throw new Error(init.error || "Could not start payment");
          location.href = init.authorization_url; // callback returns to /track.html?ref=…
        }
      } catch (err) {
        console.error(err);
        window.FB_toast(err.message || "Something went wrong", true);
        btn.disabled = false; btn.textContent = "Place order";
      }
    });

    function finish(order, reference) {
      window.FB_Cart.clear();
      const q = new URLSearchParams({ n: order.order_number || "" });
      if (reference) q.set("ref", reference);
      location.href = "track.html?" + q.toString();
    }
  });
})();
