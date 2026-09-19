/* Flutter Batter Admin — UI: boot, auth, sidebar, and the 13 sections.
   Sections: Overview, Orders, Products, Categories, Customers, Reviews,
   Coupons, Delivery, Notifications, Content, Homepage, SEO, Media. */
(function () {
  "use strict";
  const A = window.FBA, CFG = window.FB_CONFIG;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = A.esc, money = A.money;

  const SECTIONS = [
    ["sep", "Daily"],
    ["overview", "📊", "Overview"],
    ["orders", "🧾", "Orders"],
    ["customers", "👥", "Customers"],
    ["sep", "Catalog"],
    ["products", "🥞", "Products"],
    ["categories", "🏷", "Categories"],
    ["coupons", "🎟", "Coupons"],
    ["reviews", "⭐", "Reviews"],
    ["sep", "Site"],
    ["delivery", "🛵", "Delivery"],
    ["notifications", "🔔", "Notifications"],
    ["content", "📝", "Content"],
    ["homepage", "🏠", "Homepage"],
    ["seo", "🔍", "SEO"],
    ["media", "🖼", "Media"],
  ];
  const TITLES = Object.fromEntries(SECTIONS.filter((s) => s[0] !== "sep").map((s) => [s[0], s[2]]));
  const STAFF_ONLY = ["orders", "customers", "reviews"]; // staff can see these but not edit

  let current = "overview";

  /* ============ toast & modal ============ */
  function toast(msg, err) {
    const t = document.createElement("div");
    t.className = "toast" + (err ? " err" : "");
    t.textContent = msg;
    $("#toastZone").appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").classList.add("open"); $("#veil").classList.add("open"); }
  function closeModal() { $("#modal").classList.remove("open"); $("#veil").classList.remove("open"); }

  /* ============ auth ============ */
  async function boot() {
    $("#lgModeNote").textContent = A.LIVE
      ? "Connected to Supabase" : "Demo mode — no Supabase keys. Any email + 6-char password works.";
    $("#demoPill").style.display = A.LIVE ? "none" : "";
    if (!window.supabase && A.LIVE) { $("#lgMsg").textContent = "supabase-js failed to load (network?)"; return; }

    await A.restoreSession();
    if (A.role) return showApp();

    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#lgBtn");
      btn.disabled = true; $("#lgMsg").textContent = "";
      try {
        await A.signIn($("#lgEmail").value.trim(), $("#lgPass").value);
        showApp();
      } catch (err) {
        $("#lgMsg").textContent = err.message || "Sign-in failed";
        btn.disabled = false;
      }
    });
  }

  function showApp() {
    $("#loginScreen").style.display = "none";
    $("#appShell").style.display = "grid";
    $("#whoami").textContent = `${A.email} · ${A.role}`;
    renderNav();
    goto("overview");
  }

  function renderNav() {
    $("#sideNav").innerHTML = SECTIONS.map((s) => {
      if (s[0] === "sep") return `<div class="sep">${s[1]}</div>`;
      return `<button data-sec="${s[0]}" class="${s[0] === current ? "on" : ""}"><span>${s[1]}</span>${s[2]}</button>`;
    }).join("");
    $$("#sideNav [data-sec]").forEach((b) => b.addEventListener("click", () => {
      goto(b.dataset.sec);
      $("#sidebar").classList.remove("open");
    }));
  }

  async function goto(sec) {
    current = sec;
    $("#pageTitle").textContent = TITLES[sec] || "";
    renderNav();
    const body = $("#mainBody");
    body.innerHTML = `<div class="empty">Loading…</div>`;
    try {
      await RENDER[sec]();
    } catch (e) {
      body.innerHTML = `<div class="card pad empty">Couldn't load this section: ${esc(e.message)}</div>`;
    }
  }

  /* ============ helpers ============ */
  const statusBadge = (s) => {
    const map = { received: ["badge-gold", "received"], preparing: ["badge-ink", "preparing"], dispatched: ["badge-ink", "dispatched"], delivered: ["badge-green", "delivered"], cancelled: ["badge-red", "cancelled"] };
    const [cls, label] = map[s] || ["badge-gold", s];
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  };
  const payBadge = (o) => o.payment_status === "paid" ? '<span class="badge badge-green">paid</span>'
    : o.payment_status === "failed" ? '<span class="badge badge-red">failed</span>' : '<span class="badge badge-gold">pending</span>';
  const dt = (s) => new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const can = (roles) => A.role && roles.includes(A.role);

  function barChart(series) {
    const max = Math.max(...series.map((d) => d.revenue), 1);
    return `<div class="bar-chart">${series.map((d) => `
      <div class="bar ${d.revenue ? "" : "zero"}" style="height:${Math.max(2, (d.revenue / max) * 100)}%">
        <span class="tip">${d.label}: ${money(d.revenue)} · ${d.orders} ord.</span>
      </div>`).join("")}</div>
      <div class="chart-x">${series.map((d) => `<span>${d.label.split(" ")[0]}</span>`).join("")}</div>`;
  }

  /* ============ sections ============ */
  const RENDER = {};

  RENDER.overview = async () => {
    const o = await A.overview();
    const delta = o.todayOrders - o.yesterdayOrders;
    $("#mainBody").innerHTML = `
      <div class="kpis">
        <div class="card kpi"><div class="l">Revenue today</div><div class="v">${money(o.todayRevenue)}</div>
          <div class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} orders vs yesterday</div></div>
        <div class="card kpi"><div class="l">Orders today</div><div class="v">${o.todayOrders}</div><div class="muted">${o.pending} awaiting action</div></div>
        <div class="card kpi"><div class="l">Average order</div><div class="v">${money(o.aov)}</div><div class="muted">across ${o.totalOrders} orders</div></div>
        <div class="card kpi"><div class="l">14-day revenue</div><div class="v">${money(o.series.reduce((s, d) => s + d.revenue, 0))}</div><div class="muted">paid orders only</div></div>
      </div>
      <div class="two-col">
        <div class="card pad"><h3 style="margin-bottom:12px">Revenue — last 14 days</h3>${barChart(o.series)}</div>
        <div class="card pad">
          <h3 style="margin-bottom:8px">Top products</h3>
          ${o.top.length ? o.top.map((t) => `<div class="list-row"><span>${esc(t.name)} <span class="muted">× ${t.qty}</span></span><b>${money(t.revenue)}</b></div>`).join("") : '<div class="empty">No sales yet</div>'}
        </div>
      </div>
      <div class="card pad section-gap">
        <h3 style="margin-bottom:8px">Latest orders</h3>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${o.recent.map((x) => `<tr>
            <td class="mono">${esc(x.order_number || x.id)}</td><td>${esc(x.customer_name)}</td>
            <td>${statusBadge(x.status)}</td><td>${payBadge(x)}</td>
            <td style="text-align:right"><b>${money(x.total)}</b></td></tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  };

  RENDER.orders = async () => {
    let filter = "all";
    const draw = async () => {
      const list = await A.orders(filter);
      $("#ordersTable").innerHTML = `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Area</th><th>Payment</th><th>Status</th><th style="text-align:right">Total</th><th></th></tr></thead>
          <tbody>${list.length ? list.map((o) => `<tr>
            <td class="mono">${esc(o.order_number || o.id)}</td>
            <td class="muted">${dt(o.created_at)}</td>
            <td>${esc(o.customer_name)}<div class="muted">${esc(o.customer_phone)}</div></td>
            <td>${esc(o.address_area)}</td>
            <td>${payBadge(o)}<div class="muted">${o.payment_method === "paystack" ? "online" : "cash"}</div></td>
            <td>${statusBadge(o.status)}</td>
            <td style="text-align:right"><b>${money(o.total)}</b></td>
            <td><button class="btn btn-ghost btn-sm" data-open="${o.id}">View</button></td>
          </tr>`).join("") : '<tr><td colspan="8" class="empty">No orders in this filter</td></tr>'}</tbody>
        </table></div>`;
      $$("#ordersTable [data-open]").forEach((b) => b.addEventListener("click", () => orderModal(list.find((o) => o.id === b.dataset.open), draw)));
    };
    $("#mainBody").innerHTML = `
      <div class="filters" id="orderFilters">
        ${["all", "received", "preparing", "dispatched", "delivered", "cancelled"].map((s) =>
          `<button class="chip ${s === "all" ? "on" : ""}" data-f="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}
      </div>
      <div class="card" id="ordersTable"></div>`;
    $$("#orderFilters [data-f]").forEach((c) => c.addEventListener("click", () => {
      $$("#orderFilters .chip").forEach((x) => x.classList.remove("on"));
      c.classList.add("on"); filter = c.dataset.f; draw();
    }));
    await draw();
  };

  async function orderModal(o, after) {
    const items = (o.items || []).map((i) =>
      `<div class="list-row"><span>${esc(i.product_name)} × ${i.quantity}</span><span>${money(i.line_total ?? i.unit_price * i.quantity)}</span></div>`).join("");
    const edit = can(["admin", "manager"]);
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 class="mono">${esc(o.order_number || o.id)}</h3>${statusBadge(o.status)} ${payBadge(o)}
      </div>
      <p class="muted">Placed ${dt(o.created_at)}</p>
      <div class="section-gap">
        <b>${esc(o.customer_name)}</b> · ${esc(o.customer_phone)}${o.customer_email ? ` · ${esc(o.customer_email)}` : ""}
        <div class="muted">${esc(o.address_area)} — ${esc(o.address_street || "")}${o.address_notes ? ` · note: ${esc(o.address_notes)}` : ""}</div>
      </div>
      <div class="section-gap">${items || '<p class="muted">No item rows stored.</p>'}</div>
      <div class="list-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${Number(o.discount) ? `<div class="list-row"><span>Discount ${o.coupon_code ? `(${esc(o.coupon_code)})` : ""}</span><span>−${money(o.discount)}</span></div>` : ""}
      <div class="list-row"><span>Delivery</span><span>${money(o.delivery_fee)}</span></div>
      <div class="list-row" style="font-weight:800"><span>Total</span><span>${money(o.total)}</span></div>
      ${o.note ? `<p class="section-gap"><b>Note:</b> ${esc(o.note)}</p>` : ""}
      ${edit ? `
      <hr class="section-gap" style="border:none;border-top:1px solid var(--cream-line)">
      <div class="form-grid two section-gap">
        <div class="field"><label>Order status</label>
          <select id="omStatus">${["received", "preparing", "dispatched", "delivered", "cancelled"].map((s) =>
            `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Payment</label>
          <select id="omPay">${["pending", "paid", "failed", "refunded"].map((s) =>
            `<option ${s === o.payment_status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      ${o.payment_method === "paystack" && o.paystack_reference ? `<p class="muted">Paystack ref: <span class="mono">${esc(o.paystack_reference)}</span></p>` : ""}
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-primary" id="omSave">Save changes</button>
        ${can(["admin"]) ? `<button class="btn btn-danger" id="omDel">Delete order</button>` : ""}
      </div>` : `<p class="muted section-gap">Your role can view but not modify orders.</p>`}
    `);
    if (edit) {
      $("#omSave").addEventListener("click", async () => {
        try {
          await A.updateOrder(o.id, { status: $("#omStatus").value, payment_status: $("#omPay").value });
          toast("Order updated"); closeModal(); await after();
        } catch (e) { toast(e.message, true); }
      });
      const del = $("#omDel");
      if (del) del.addEventListener("click", async () => {
        if (!confirm("Permanently delete this order?")) return;
        try { await A.deleteOrder(o.id); toast("Order deleted"); closeModal(); await after(); }
        catch (e) { toast(e.message, true); }
      });
    }
  }

  RENDER.products = async () => {
    const [prods, cats] = await Promise.all([A.products(), A.categories()]);
    const draw = () => {
      $("#prodTable").innerHTML = `
        <div class="table-wrap"><table class="data">
          <thead><tr><th></th><th>Product</th><th>Price</th><th>Category</th><th>Flags</th><th></th></tr></thead>
          <tbody>${prods.map((p) => `<tr>
            <td><img class="thumb" src="${p.image_url || ""}" alt="" onerror="this.style.visibility='hidden'"></td>
            <td><b>${esc(p.name)}</b><div class="muted mono">${esc(p.slug)}</div></td>
            <td><b>${money(p.price)}</b></td>
            <td>${esc(prods.categories?.name || (cats.find((c) => c.id === p.category_id)?.name || "—"))}</td>
            <td>${p.is_featured ? '<span class="badge badge-gold">featured</span> ' : ""}${p.is_best_seller ? '<span class="badge badge-ink">best</span> ' : ""}${p.is_active ? "" : '<span class="badge badge-red">hidden</span>'}</td>
            <td style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
              ${can(["admin"]) ? `<button class="btn btn-danger btn-sm" data-del="${p.id}">✕</button>` : ""}
            </td></tr>`).join("")}</tbody>
        </table></div>`;
      $$("#prodTable [data-edit]").forEach((b) => b.addEventListener("click", () => productModal(prods.find((p) => p.id === b.dataset.edit))));
      $$("#prodTable [data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Delete this product?")) return;
        try { await A.deleteProduct(b.dataset.del); toast("Product deleted"); await RENDER.products(); }
        catch (e) { toast(e.message, true); }
      }));
    };
    $("#mainBody").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <p class="muted">${prods.length} products</p>
        ${can(["admin", "manager"]) ? `<button class="btn btn-gold" id="addProd">+ New product</button>` : ""}
      </div>
      <div class="card" id="prodTable"></div>`;
    const add = $("#addProd");
    if (add) add.addEventListener("click", () => productModal(null));
    draw();
  };

  function productModal(p) {
    const catsP = A.categories();
    openModal("Loading…");
    catsP.then((cats) => {
      openModal(`
        <h3>${p ? "Edit product" : "New product"}</h3>
        <div class="field section-gap"><label>Name</label><input id="pmName" value="${esc(p?.name || "")}" maxlength="80"></div>
        <div class="form-grid two">
          <div class="field"><label>Price (GHS)</label><input id="pmPrice" type="number" min="0" step="0.5" value="${p?.price ?? ""}"></div>
          <div class="field"><label>Category</label><select id="pmCat">
            <option value="">— none —</option>
            ${cats.map((c) => `<option value="${c.id}" ${p?.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select></div>
        </div>
        <div class="field"><label>Description</label><textarea id="pmDesc" rows="3" maxlength="500">${esc(p?.description || "")}</textarea></div>
        <div class="field"><label>Image URL</label><input id="pmImg" value="${esc(p?.image_url || "")}" placeholder="assets/img/... or https://"></div>
        <div class="field"><label>Ingredients (shown on product page)</label><input id="pmIngr" value="${esc(p?.ingredients || "")}" maxlength="240"></div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin:6px 0 14px">
          <label class="switch"><input type="checkbox" id="pmActive" ${p?.is_active !== false ? "checked" : ""}><span class="track"></span></label><span style="align-self:center">Active (visible in shop)</span>
          <label class="switch"><input type="checkbox" id="pmFeat" ${p?.is_featured ? "checked" : ""}><span class="track"></span></label><span style="align-self:center">Featured</span>
          <label class="switch"><input type="checkbox" id="pmBest" ${p?.is_best_seller ? "checked" : ""}><span class="track"></span></label><span style="align-self:center">Best seller</span>
        </div>
        <div style="display:flex;gap:10px"><button class="btn btn-primary" id="pmSave">Save</button><button class="btn btn-ghost" id="pmCancel">Cancel</button></div>
      `);
      $("#pmCancel").addEventListener("click", closeModal);
      $("#pmSave").addEventListener("click", async () => {
        try {
          const row = {
            ...(p ? { id: p.id } : {}),
            name: $("#pmName").value.trim(),
            slug: p?.slug || $("#pmName").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            price: parseFloat($("#pmPrice").value || 0),
            category_id: $("#pmCat").value || null,
            description: $("#pmDesc").value.trim(),
            image_url: $("#pmImg").value.trim(),
            ingredients: $("#pmIngr").value.trim(),
            is_active: $("#pmActive").checked, is_featured: $("#pmFeat").checked, is_best_seller: $("#pmBest").checked,
          };
          if (!row.name) return toast("Name is required", true);
          await A.saveProduct(row);
          toast("Product saved"); closeModal(); await RENDER.products();
        } catch (e) { toast(e.message, true); }
      });
    });
  }

  RENDER.categories = async () => {
    const cats = await A.categories();
    $("#mainBody").innerHTML = `
      ${can(["admin", "manager"]) ? `<p style="margin-bottom:14px"><button class="btn btn-gold" id="addCat">+ New category</button></p>` : ""}
      <div class="card pad">${cats.length ? cats.map((c) => `
        <div class="list-row">
          <span><b>${esc(c.name)}</b> <span class="muted mono">${esc(c.slug)}</span><div class="muted">${esc(c.description || "")}</div></span>
          <span style="white-space:nowrap">
            ${can(["admin", "manager"]) ? `<button class="btn btn-ghost btn-sm" data-edit="${c.id}">Edit</button>` : ""}
            ${can(["admin"]) ? `<button class="btn btn-danger btn-sm" data-del="${c.id}">✕</button>` : ""}
          </span>
        </div>`).join("") : '<div class="empty">No categories</div>'}</div>`;
    const add = $("#addCat");
    if (add) add.addEventListener("click", () => catModal(null, cats));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => catModal(cats.find((c) => c.id === b.dataset.edit), cats)));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete category? Products will be uncategorised.")) return;
      try { await A.deleteCategory(b.dataset.del); toast("Category deleted"); await RENDER.categories(); }
      catch (e) { toast(e.message, true); }
    }));
  };
  function catModal(c) {
    openModal(`
      <h3>${c ? "Edit category" : "New category"}</h3>
      <div class="field section-gap"><label>Name</label><input id="cmName" value="${esc(c?.name || "")}"></div>
      <div class="field"><label>Description</label><input id="cmDesc" value="${esc(c?.description || "")}"></div>
      <div class="field"><label>Sort order</label><input id="cmSort" type="number" value="${c?.sort_order ?? 99}"></div>
      <div style="display:flex;gap:10px"><button class="btn btn-primary" id="cmSave">Save</button><button class="btn btn-ghost" id="cmCancel">Cancel</button></div>`);
    $("#cmCancel").addEventListener("click", closeModal);
    $("#cmSave").addEventListener("click", async () => {
      try {
        await A.saveCategory({
          ...(c ? { id: c.id } : {}),
          name: $("#cmName").value.trim(), slug: c?.slug || $("#cmName").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          description: $("#cmDesc").value.trim(), sort_order: +$("#cmSort").value || 99,
        });
        toast("Saved"); closeModal(); await RENDER.categories();
      } catch (e) { toast(e.message, true); }
    });
  }

  RENDER.customers = async () => {
    const list = await A.customers();
    $("#mainBody").innerHTML = `
      <div class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>Customer</th><th>Contact</th><th>Area</th><th style="text-align:right">Orders</th><th style="text-align:right">Total spend</th><th>Since</th></tr></thead>
        <tbody>${list.length ? list.map((c) => `<tr>
          <td><b>${esc(c.full_name || "—")}</b></td>
          <td>${esc(c.phone || "—")}<div class="muted">${esc(c.email || "")}</div></td>
          <td>${esc(c.area || "—")}</td>
          <td style="text-align:right">${c.orders ?? "—"}</td>
          <td style="text-align:right"><b>${c.spend != null ? money(c.spend) : "—"}</b></td>
          <td class="muted">${c.created_at ? dt(c.created_at) : "—"}</td>
        </tr>`).join("") : '<tr><td colspan="6" class="empty">No customers yet</td></tr>'}</tbody>
      </table></div></div>`;
  };

  RENDER.reviews = async () => {
    let filter = "pending";
    const draw = async () => {
      const list = await A.reviews(filter);
      $("#revTable").innerHTML = list.length ? list.map((r) => `
        <div class="card pad" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
            <div>
              <span class="stars" style="color:var(--gold)">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
              <b>${esc(r.title || "Review")}</b> <span class="muted">· ${esc(r.products?.name || r.product_id || "")}</span>
              <p class="sub" style="margin:6px 0">“${esc(r.body)}”</p>
              <span class="muted">${esc(r.author_name)} · ${dt(r.created_at)}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="badge ${r.status === "approved" ? "badge-green" : r.status === "rejected" ? "badge-red" : "badge-gold"}">${r.status}</span>
              ${can(["admin", "manager"]) ? `
                ${r.status !== "approved" ? `<button class="btn btn-ghost btn-sm" data-ap="${r.id}">Approve</button>` : ""}
                ${r.status !== "rejected" ? `<button class="btn btn-ghost btn-sm" data-rj="${r.id}">Reject</button>` : ""}
                <button class="btn btn-ghost btn-sm" data-ft="${r.id}">${r.is_featured ? "Unfeature" : "Feature"}</button>
                <button class="btn btn-danger btn-sm" data-dl="${r.id}">✕</button>` : ""}
            </div>
          </div>
        </div>`).join("") : `<div class="card pad empty">No ${filter} reviews</div>`;
      $$("[data-ap]").forEach((b) => b.addEventListener("click", async () => { await A.updateReview(b.dataset.ap, { status: "approved" }); toast("Approved"); draw(); }));
      $$("[data-rj]").forEach((b) => b.addEventListener("click", async () => { await A.updateReview(b.dataset.rj, { status: "rejected" }); toast("Rejected"); draw(); }));
      $$("[data-ft]").forEach((b) => b.addEventListener("click", async () => {
        const r = list.find((x) => x.id === b.dataset.ft);
        await A.updateReview(r.id, { is_featured: !r.is_featured }); toast("Updated"); draw();
      }));
      $$("[data-dl]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Delete review permanently?")) return;
        await A.deleteReview(b.dataset.dl); toast("Deleted"); draw();
      }));
    };
    $("#mainBody").innerHTML = `
      <div class="filters">${["pending", "approved", "rejected", "all"].map((s) =>
        `<button class="chip ${s === "pending" ? "on" : ""}" data-f="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div>
      <div id="revTable"></div>`;
    $$("#mainBody [data-f]").forEach((c) => c.addEventListener("click", () => {
      $$("#mainBody .chip").forEach((x) => x.classList.remove("on"));
      c.classList.add("on"); filter = c.dataset.f; draw();
    }));
    await draw();
  };

  RENDER.coupons = async () => {
    const list = await A.coupons();
    $("#mainBody").innerHTML = `
      ${can(["admin", "manager"]) ? `<p style="margin-bottom:14px"><button class="btn btn-gold" id="addCoup">+ New coupon</button></p>` : ""}
      <div class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((c) => `<tr>
          <td><b class="mono">${esc(c.code)}</b></td>
          <td>${c.discount_type === "percent" ? c.discount_value + "%" : money(c.discount_value)}</td>
          <td>${money(c.min_order)}</td>
          <td>${c.used_count ?? 0}${c.max_uses ? " / " + c.max_uses : ""}</td>
          <td class="muted">${c.expires_at ? dt(c.expires_at) : "never"}</td>
          <td>${c.is_active ? '<span class="badge badge-green">active</span>' : '<span class="badge badge-red">off</span>'}</td>
          <td style="white-space:nowrap">
            ${can(["admin", "manager"]) ? `<button class="btn btn-ghost btn-sm" data-edit="${c.id}">Edit</button>` : ""}
            ${can(["admin"]) ? `<button class="btn btn-danger btn-sm" data-del="${c.id}">✕</button>` : ""}
          </td></tr>`).join("") : '<tr><td colspan="7" class="empty">No coupons yet</td></tr>'}</tbody>
      </table></div></div>`;
    const add = $("#addCoup");
    if (add) add.addEventListener("click", () => coupModal(null));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => coupModal(list.find((c) => c.id === b.dataset.edit))));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("Delete coupon?")) return;
      try { await A.deleteCoupon(b.dataset.del); toast("Deleted"); await RENDER.coupons(); }
      catch (e) { toast(e.message, true); }
    }));
  };
  function coupModal(c) {
    openModal(`
      <h3>${c ? "Edit coupon" : "New coupon"}</h3>
      <div class="form-grid two section-gap">
        <div class="field"><label>Code</label><input id="cpCode" value="${esc(c?.code || "")}" style="text-transform:uppercase" maxlength="20"></div>
        <div class="field"><label>Type</label><select id="cpType">
          <option value="percent" ${c?.discount_type === "percent" ? "selected" : ""}>Percent %</option>
          <option value="fixed" ${c?.discount_type === "fixed" ? "selected" : ""}>Fixed GHS</option></select></div>
        <div class="field"><label>Value</label><input id="cpVal" type="number" min="1" step="1" value="${c?.discount_value ?? 10}"></div>
        <div class="field"><label>Minimum order (GHS)</label><input id="cpMin" type="number" min="0" value="${c?.min_order ?? 0}"></div>
        <div class="field"><label>Max uses (blank = ∞)</label><input id="cpMax" type="number" min="1" value="${c?.max_uses ?? ""}"></div>
        <div class="field"><label>Expires</label><input id="cpExp" type="date" value="${c?.expires_at ? c.expires_at.slice(0, 10) : ""}"></div>
      </div>
      <label class="switch" style="margin-bottom:14px"><input type="checkbox" id="cpOn" ${c?.is_active !== false ? "checked" : ""}><span class="track"></span></label> <span>Active</span>
      <div style="display:flex;gap:10px;margin-top:10px"><button class="btn btn-primary" id="cpSave">Save</button><button class="btn btn-ghost" id="cpCancel">Cancel</button></div>`);
    $("#cpCancel").addEventListener("click", closeModal);
    $("#cpSave").addEventListener("click", async () => {
      try {
        await A.saveCoupon({
          ...(c ? { id: c.id } : {}),
          code: $("#cpCode").value, discount_type: $("#cpType").value,
          discount_value: parseFloat($("#cpVal").value || 0), min_order: parseFloat($("#cpMin").value || 0),
          max_uses: $("#cpMax").value ? +$("#cpMax").value : null,
          expires_at: $("#cpExp").value || null, is_active: $("#cpOn").checked,
        });
        toast("Coupon saved"); closeModal(); await RENDER.coupons();
      } catch (e) { toast(e.message, true); }
    });
  }

  RENDER.delivery = async () => {
    const s = await A.getSettings();
    const d = s.delivery || { zones: [] };
    $("#mainBody").innerHTML = `
      <div class="card pad">
        <h3 style="margin-bottom:12px">Zones & fees</h3>
        <div id="zoneRows">${d.zones.map((z, i) => `
          <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px" data-zone="${i}">
            <input data-k="name" value="${esc(z.name)}" placeholder="Zone name">
            <input data-k="fee" type="number" min="0" value="${z.fee}" placeholder="Fee">
            <input data-k="eta" value="${esc(z.eta)}" placeholder="ETA">
            <button class="btn btn-danger btn-sm" data-rm="${i}">✕</button>
          </div>`).join("")}</div>
        <button class="btn btn-ghost btn-sm" id="addZone">+ Add zone</button>
        <hr class="section-gap" style="border:none;border-top:1px solid var(--cream-line)">
        <div class="form-grid two">
          <div class="field"><label>Delivery hours</label><input id="dHours" value="${esc(d.hours || "")}"></div>
          <div class="field"><label>Notice shown at checkout</label><input id="dNote" value="${esc(d.note || "")}"></div>
        </div>
        <button class="btn btn-primary" id="saveDelivery">Save delivery settings</button>
      </div>`;
    $("#addZone").addEventListener("click", () => {
      const div = document.createElement("div");
      div.className = "form-grid"; div.style.cssText = "grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px";
      div.innerHTML = `<input data-k="name" placeholder="Zone name"><input data-k="fee" type="number" value="20"><input data-k="eta" placeholder="ETA"><button class="btn btn-danger btn-sm">✕</button>`;
      div.querySelector("button").addEventListener("click", () => div.remove());
      $("#zoneRows").appendChild(div);
    });
    $$("#zoneRows [data-rm]").forEach((b) => b.addEventListener("click", () => b.closest("[data-zone]").remove()));
    $("#saveDelivery").addEventListener("click", async () => {
      try {
        const zones = $$("#zoneRows [data-zone]").map((row) => ({
          name: row.querySelector('[data-k="name"]').value.trim(),
          fee: parseFloat(row.querySelector('[data-k="fee"]').value || 0),
          eta: row.querySelector('[data-k="eta"]').value.trim(),
        })).filter((z) => z.name);
        await A.saveSetting("delivery", { zones, hours: $("#dHours").value.trim(), note: $("#dNote").value.trim() });
        toast("Delivery settings saved — live on the site immediately");
      } catch (e) { toast(e.message, true); }
    });
  };

  RENDER.notifications = async () => {
    const list = await A.notifications();
    $("#mainBody").innerHTML = `
      <div class="two-col">
        <div class="card pad">
          <h3 style="margin-bottom:6px">Send a push notification</h3>
          <p class="muted" style="margin-bottom:14px">Goes to everyone who allowed notifications, via OneSignal.</p>
          <div class="field"><label>Title</label><input id="ntTitle" maxlength="60" placeholder="e.g. Friday special 🥞"></div>
          <div class="field"><label>Message</label><textarea id="ntBody" rows="3" maxlength="180" placeholder="Short and appetising…"></textarea></div>
          <div class="field"><label>Open URL (optional)</label><input id="ntUrl" placeholder="/menu.html"></div>
          ${can(["admin", "manager"]) ? `<button class="btn btn-gold" id="ntSend">Send now</button>` : `<p class="muted">Your role can't send notifications.</p>`}
        </div>
        <div class="card pad">
          <h3 style="margin-bottom:10px">History</h3>
          ${list.length ? list.map((n) => `<div class="list-row"><span><b>${esc(n.title)}</b><div class="muted">${esc(n.body)}</div></span><span class="muted">${dt(n.created_at)}</span></div>`).join("") : '<div class="empty">Nothing sent yet</div>'}
        </div>
      </div>`;
    const btn = $("#ntSend");
    if (btn) btn.addEventListener("click", async () => {
      const title = $("#ntTitle").value.trim(), body = $("#ntBody").value.trim();
      if (!title || !body) return toast("Title and message are required", true);
      try {
        const res = await A.sendNotification({ title, body, url: $("#ntUrl").value.trim() || null, audience: "all", sent_via: "onesignal" });
        toast(res.demo ? "Saved (demo mode — connect Supabase + OneSignal to really send)" : `Sent to ${res.sent} devices`);
        await RENDER.notifications();
      } catch (e) { toast(e.message, true); }
    });
  };

  RENDER.content = async () => {
    const s = await A.getSettings();
    const site = s.site || {};
    $("#mainBody").innerHTML = `
      <div class="card pad" style="max-width:620px">
        <h3 style="margin-bottom:14px">Site identity</h3>
        <div class="field"><label>Brand name</label><input id="ctName" value="${esc(site.name || "")}"></div>
        <div class="field"><label>Tagline</label><input id="ctTag" value="${esc(site.tagline || "")}"></div>
        <div class="form-grid two">
          <div class="field"><label>WhatsApp number</label><input id="ctWa" value="${esc(site.whatsapp || "")}"></div>
          <div class="field"><label>Email</label><input id="ctEmail" value="${esc(site.email || "")}"></div>
        </div>
        <div class="field"><label>Instagram URL</label><input id="ctIg" value="${esc(site.instagram || "")}"></div>
        <button class="btn btn-primary" id="saveContent">Save</button>
      </div>`;
    $("#saveContent").addEventListener("click", async () => {
      try {
        await A.saveSetting("site", {
          name: $("#ctName").value.trim(), tagline: $("#ctTag").value.trim(),
          whatsapp: $("#ctWa").value.trim(), email: $("#ctEmail").value.trim(), instagram: $("#ctIg").value.trim(),
        });
        toast("Site content saved — the customer site reads this live");
      } catch (e) { toast(e.message, true); }
    });
  };

  RENDER.homepage = async () => {
    const s = await A.getSettings();
    const hp = s.homepage || {};
    const secLabels = { hero: "Hero video", featured: "Featured products", best_sellers: "Best sellers", how_it_works: "How it works", testimonials: "Testimonials", stats: "Statistics", coverage_map: "Coverage map", faq: "FAQ", instagram: "Instagram", cta: "CTA band" };
    $("#mainBody").innerHTML = `
      <div class="card pad" style="max-width:620px">
        <h3 style="margin-bottom:14px">Hero copy</h3>
        <div class="field"><label>Heading</label><input id="hpHead" value="${esc(hp.hero_heading || "")}"></div>
        <div class="field"><label>Sub-line</label><input id="hpSub" value="${esc(hp.hero_sub || "")}"></div>
        <h3 style="margin:20px 0 12px">Homepage sections</h3>
        ${Object.entries(secLabels).map(([k, label]) => `
          <div class="list-row"><span>${label}</span>
            <label class="switch"><input type="checkbox" data-sec="${k}" ${hp.sections?.[k] !== false ? "checked" : ""}><span class="track"></span></label>
          </div>`).join("")}
        <button class="btn btn-primary section-gap" id="saveHp" style="margin-top:16px">Save homepage</button>
      </div>`;
    $("#saveHp").addEventListener("click", async () => {
      try {
        const sections = {};
        $$("[data-sec]").forEach((c) => (sections[c.dataset.sec] = c.checked));
        await A.saveSetting("homepage", { hero_heading: $("#hpHead").value.trim(), hero_sub: $("#hpSub").value.trim(), sections });
        toast("Homepage saved");
      } catch (e) { toast(e.message, true); }
    });
  };

  RENDER.seo = async () => {
    const s = await A.getSettings();
    const seo = s.seo || {};
    $("#mainBody").innerHTML = `
      <div class="card pad" style="max-width:620px">
        <h3 style="margin-bottom:14px">Search engine snippets</h3>
        <div class="field"><label>Page title (≤60 chars)</label><input id="seTitle" maxlength="60" value="${esc(seo.title || "")}">
          <span class="muted" id="seTitleCount"></span></div>
        <div class="field"><label>Meta description (≤155 chars)</label><textarea id="seDesc" rows="3" maxlength="155">${esc(seo.description || "")}</textarea>
          <span class="muted" id="seDescCount"></span></div>
        <div class="field"><label>Keywords</label><input id="seKeys" value="${esc(seo.keywords || "")}"></div>
        <button class="btn btn-primary" id="saveSeo">Save</button>
      </div>`;
    const cnt = () => {
      $("#seTitleCount").textContent = $("#seTitle").value.length + "/60";
      $("#seDescCount").textContent = $("#seDesc").value.length + "/155";
    };
    $("#seTitle").addEventListener("input", cnt); $("#seDesc").addEventListener("input", cnt); cnt();
    $("#saveSeo").addEventListener("click", async () => {
      try {
        await A.saveSetting("seo", { title: $("#seTitle").value.trim(), description: $("#seDesc").value.trim(), keywords: $("#seKeys").value.trim() });
        toast("SEO saved");
      } catch (e) { toast(e.message, true); }
    });
  };

  RENDER.media = async () => {
    // static listing of bundled assets; live mode can add Supabase Storage
    const files = ["assets/img/pancake.jpg", "assets/img/fusion.jpg", "assets/img/classic.jpg", "media/hero.mp4", "icons/icon-192.png", "icons/icon-512.png"];
    $("#mainBody").innerHTML = `
      <div class="card pad">
        <h3 style="margin-bottom:6px">Bundled media</h3>
        <p class="muted" style="margin-bottom:14px">Copy a path into a product's Image URL. In live mode you can also upload to Supabase Storage and paste those URLs.</p>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
          ${files.map((f) => `
            <div class="card pad" style="text-align:center">
              ${f.endsWith(".mp4") ? `<video src="${f}" muted style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover"></video>` : `<img src="${f}" style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover" loading="lazy">`}
              <div class="muted mono" style="font-size:.7rem;margin-top:8px;word-break:break-all">${esc(f)}</div>
              <button class="btn btn-ghost btn-sm" style="margin-top:6px" data-copy="${f}">Copy path</button>
            </div>`).join("")}
        </div>
      </div>`;
    $$("[data-copy]").forEach((b) => b.addEventListener("click", () => {
      navigator.clipboard?.writeText(b.dataset.copy);
      toast("Path copied");
    }));
  };

  /* ============ boot ============ */
  $("#veil").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  $("#logoutBtn").addEventListener("click", async () => { await A.signOut(); location.reload(); });
  $("#sideToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  boot();
})();
