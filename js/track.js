/* Order tracking: lookup by order number or Paystack reference + timeline */
(function () {
  "use strict";
  const FB = window.FB, CFG = window.FB_CONFIG;
  const STEPS = [
    ["received",   "Order received",    "We've got your order and the kitchen is confirming it."],
    ["preparing",  "Boxing your order", "Your box is being prepared fresh and wrapped."],
    ["dispatched", "Out for delivery",  "The rider is on the way to you."],
    ["delivered",  "Delivered",         "Enjoy! Tag us on Instagram @flutterbatter 🧡"],
  ];
  window.FB_page.on(() => {
    const input = document.getElementById("trackInput");
    const result = document.getElementById("trackResult");

    async function track(value) {
      result.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--ink-faint)">Looking up your order…</div>`;
      try {
        const o = await FB.trackOrder(value);
        if (!o) {
          result.innerHTML = `<div class="card empty" style="padding:40px">No order found for <b class="mono">${FB.esc(value)}</b>.<br>
            <span style="font-size:.9rem">Check the number, or <a href="https://wa.me/${CFG.WHATSAPP}" target="_blank" rel="noopener">WhatsApp us</a> and we'll find it.</span></div>`;
          return;
        }
        render(o);
      } catch (e) {
        result.innerHTML = `<div class="card empty" style="padding:40px">Couldn't reach the order service — please try again.</div>`;
      }
    }

    function render(o) {
      const idx = o.status === "cancelled" ? -1 : STEPS.findIndex((s) => s[0] === o.status);
      const pay = o.payment_status === "paid"
        ? `<span class="badge badge-green">Paid${o.payment_method === "paystack" ? " · Paystack" : ""}</span>`
        : o.payment_status === "failed"
          ? `<span class="badge badge-red">Payment failed</span>`
          : `<span class="badge badge-gold">Payment pending · ${o.payment_method === "cash" ? "pay ${FB.money(o.total)} on delivery" : "we will WhatsApp you a payment link"}</span>`;
      const items = (o.order_items || o.items || []).map((i) =>
        `<li>${FB.esc(i.product_name)} × ${i.quantity} — ${FB.money(i.line_total ?? i.unit_price * i.quantity)}</li>`).join("");
      result.innerHTML = `
        <div class="card" style="padding:clamp(22px,4vw,36px)">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px">
            <h2 class="mono" style="font-size:1.3rem">${FB.esc(o.order_number || o.id)}</h2>${pay}
          </div>
          <p class="sub" style="font-size:.9rem">For ${FB.esc(o.customer_name || "you")} · ${FB.esc(o.address_area)} · placed ${new Date(o.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
          <hr class="divider">
          ${o.status === "cancelled"
            ? `<div class="empty" style="padding:24px"><span class="badge badge-red">Cancelled</span><br><br>This order was cancelled. Questions? <a href="https://wa.me/${CFG.WHATSAPP}" target="_blank" rel="noopener">WhatsApp us</a>.</div>`
            : `<div class="timeline">${STEPS.map((s, i) => `
                <div class="tl-step ${i < idx ? "done" : i === idx ? "now" : ""}">
                  <div class="tl-rail"><div class="tl-dot"></div>${i < STEPS.length - 1 ? '<div class="tl-line"></div>' : ""}</div>
                  <div class="tl-body"><b>${s[1]}</b><span>${i <= idx ? s[2] : "Pending"}</span></div>
                </div>`).join("")}</div>`}
          <hr class="divider">
          <ul style="padding-left:20px;color:var(--ink-soft);font-size:.94rem">${items}</ul>
          <div style="display:flex;justify-content:space-between;font-weight:800;font-family:var(--font-display);font-size:1.2rem;margin-top:10px">
            <span>Total</span><span>${FB.money(o.total)}</span></div>
        </div>`;
    }

    document.getElementById("trackForm").addEventListener("submit", (e) => {
      e.preventDefault();
      track(input.value.trim());
    });

    // auto-track from URL (?n= or after checkout)
    const q = new URLSearchParams(location.search);
    const n = q.get("n") || q.get("ref");
    if (n) { input.value = n; track(n); }
  });
})();
