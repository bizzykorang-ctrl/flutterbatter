/* Account: auth (sign in/up), order history, saved addresses CRUD */
(function () {
  "use strict";
  const FB = window.FB;
  window.FB_page.on(async () => {
    const authCard = document.getElementById("authCard");
    const dash = document.getElementById("acctDash");
    const settings = await FB.settings();
    const zones = settings.delivery?.zones || [];

    /* ---------- auth tabs ---------- */
    let mode = "in";
    const tabIn = document.getElementById("tabIn"), tabUp = document.getElementById("tabUp");
    function setMode(m) {
      mode = m;
      tabIn.classList.toggle("on", m === "in");
      tabUp.classList.toggle("on", m === "up");
      document.getElementById("fName").style.display = m === "up" ? "" : "none";
      document.getElementById("authBtn").textContent = m === "up" ? "Create account" : "Sign in";
      document.getElementById("authMsg").textContent = "";
    }
    tabIn.addEventListener("click", () => setMode("in"));
    tabUp.addEventListener("click", () => setMode("up"));

    document.getElementById("authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("acEmail").value.trim();
      const pass = document.getElementById("acPass").value;
      try {
        if (mode === "up") {
          const name = document.getElementById("acName").value.trim();
          const res = await FB.signUp(email, pass, name);
          document.getElementById("authMsg").textContent = res.demo
            ? "Demo account created (sample mode — nothing is sent)." : "Check your inbox to confirm your email, then sign in.";
          if (res.demo) { await refresh(); return; }
          setMode("in");
        } else {
          await FB.signIn(email, pass);
          await refresh();
        }
      } catch (err) {
        document.getElementById("authMsg").textContent = err.message || "Something went wrong";
      }
    });

    document.getElementById("signOutBtn").addEventListener("click", async () => { await FB.signOut(); location.reload(); });

    /* ---------- addresses ---------- */
    const areaSel = document.getElementById("adArea");
    areaSel.innerHTML = zones.map((z) => `<option>${z.name}</option>`).join("");

    function addrForm(a) {
      document.getElementById("adId").value = a?.id || "";
      document.getElementById("adLabel").value = a?.label || "Home";
      document.getElementById("adStreet").value = a?.street || "";
      if (a?.area) areaSel.value = a.area;
      document.getElementById("adDefault").checked = !!a?.is_default;
      document.getElementById("addrFormTitle").textContent = a ? "Edit address" : "Add an address";
      document.getElementById("addrCancel").style.display = a ? "" : "none";
    }
    document.getElementById("addrCancel").addEventListener("click", () => addrForm());
    document.getElementById("addrForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("adId").value;
      const payload = {
        label: document.getElementById("adLabel").value.trim() || "Home",
        area: areaSel.value, street: document.getElementById("adStreet").value.trim(),
        is_default: document.getElementById("adDefault").checked,
      };
      await FB.saveAddress(id ? { id, ...payload } : payload);
      window.FB_toast("Address saved");
      addrForm();
      await refresh();
    });

    async function renderAddrs() {
      const addrs = await FB.addresses();
      document.getElementById("addrList").innerHTML = addrs.length ? addrs.map((a) => `
        <div class="card addr-card">
          <div>
            <b>${FB.esc(a.label)}</b> ${a.is_default ? '<span class="badge badge-gold">Default</span>' : ""}
            <div class="sub" style="font-size:.9rem;margin-top:4px">${FB.esc(a.area)} · ${FB.esc(a.street)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="chip" data-edit="${a.id}">Edit</button>
            <button class="chip" data-del="${a.id}" style="color:var(--red)">Delete</button>
          </div>
        </div>`).join("")
        : `<div class="empty card" style="padding:30px">No saved addresses yet.</div>`;
      document.querySelectorAll("[data-edit]").forEach((b) =>
        b.addEventListener("click", () => addrForm(addrs.find((x) => x.id === b.dataset.edit))));
      document.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", async () => {
          if (!confirm("Delete this address?")) return;
          await FB.deleteAddress(b.dataset.del);
          await refresh();
        }));
    }

    /* ---------- order history ---------- */
    async function renderOrders() {
      const orders = await FB.myOrders();
      document.getElementById("ordersList").innerHTML = orders.length ? orders.map((o) => `
        <div class="card" style="padding:18px 22px;margin-bottom:12px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center">
          <div>
            <b class="mono">${FB.esc(o.order_number || "")}</b>
            <div class="sub" style="font-size:.85rem">${new Date(o.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })} · ${(o.order_items || o.items || []).reduce((s, i) => s + i.quantity, 0)} items</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="badge ${o.status === "delivered" ? "badge-green" : o.status === "cancelled" ? "badge-red" : "badge-gold"}">${FB.esc(o.status)}</span>
            <strong>${FB.money(o.total)}</strong>
            <a class="btn btn-ghost btn-sm" href="track.html?n=${encodeURIComponent(o.order_number || "")}">Track</a>
          </div>
        </div>`).join("")
        : `<div class="empty card" style="padding:30px">No orders yet — your history will appear here.<br><br><a class="btn btn-primary btn-sm" href="menu.html">Order your first box</a></div>`;
    }

    /* ---------- state ---------- */
    async function refresh() {
      const user = await FB.user();
      authCard.style.display = user ? "none" : "";
      dash.style.display = user ? "" : "none";
      if (user) {
        document.getElementById("acctHello").textContent = `Signed in as ${user.email || "demo user"}${user.user_metadata?.full_name ? " · " + user.user_metadata.full_name : ""}`;
        await Promise.all([renderOrders(), renderAddrs()]);
      }
    }
    await refresh();
  });
})();
