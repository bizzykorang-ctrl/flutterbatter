/* Flutter Batter Admin — data layer.
   Reuses FB_CONFIG from admin-config.js. Two modes:
   - LIVE: Supabase auth + RLS (membership of public.admins = the gate)
   - DEMO: seeded sample orders/customers, edits persisted to localStorage.
   All admin writes require the admin role in LIVE mode (enforced by RLS). */
(function () {
  "use strict";
  const CFG = window.FB_CONFIG;
  let sb = null;
  const supabase = () => {
    if (!sb) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return sb;
  };
  const money = (n) => CFG.CURRENCY + Number(n).toFixed(2).replace(/\.00$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- demo store ---------------- */
  const LS = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("fba_" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("fba_" + k, JSON.stringify(v)); } catch {} },
  };
  function demoOrders() {
    if (LS.get("orders", null)) return LS.get("orders");
    const names = ["Ama A.", "Kwesi D.", "Nana A.", "Efua M.", "Kojo B.", "Adjoa L.", "Yaw T.", "Abena O."];
    const areas = ["Accra Central", "East Accra", "North Accra", "West Accra", "Tema & Adenta"];
    const prods = [["Pancake Box", 250], ["Fusion Box", 350], ["Classic Box", 300]];
    const statuses = ["delivered", "delivered", "delivered", "dispatched", "preparing", "received", "cancelled"];
    const list = [];
    for (let i = 0; i < 38; i++) {
      const d = new Date(Date.now() - i * 0.7 * 86400000 - (i % 5) * 3600000);
      const [p1, pr1] = prods[i % 3], [p2, pr2] = prods[(i + 1) % 3];
      const qty1 = 1 + (i % 2), subtotal = pr1 * qty1 + (i % 3 === 0 ? pr2 : 0);
      const st = statuses[i % statuses.length];
      list.push({
        id: "do" + i, order_number: "FB-" + d.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(1000 + i),
        customer_name: names[i % names.length], customer_phone: "024" + (4000000 + i * 13711),
        customer_email: i % 3 ? null : "guest" + i + "@example.com",
        address_area: areas[i % areas.length], address_street: "12 Palm St", delivery_fee: 20 + (i % 3) * 5,
        subtotal, discount: i % 7 === 0 ? 25 : 0, total: subtotal + 20 + (i % 3) * 5 - (i % 7 === 0 ? 25 : 0),
        coupon_code: i % 7 === 0 ? "WELCOME10" : null,
        payment_method: i % 2 ? "paystack" : "cash", paystack_reference: i % 2 ? "PSK" + (100000 + i * 977) : null,
        payment_status: st === "received" ? "pending" : "paid", status: st,
        created_at: d.toISOString(), items: [
          { product_name: p1, quantity: qty1, unit_price: pr1, line_total: pr1 * qty1 },
          ...(i % 3 === 0 ? [{ product_name: p2, quantity: 1, unit_price: pr2, line_total: pr2 }] : []),
        ],
      });
    }
    LS.set("orders", list);
    return list;
  }
  function demoCustomers() {
    const byName = {};
    demoOrders().forEach((o) => {
      const k = o.customer_name;
      byName[k] = byName[k] || { id: k, full_name: k, phone: o.customer_phone, email: o.customer_email, area: o.address_area, orders: 0, spend: 0, created_at: o.created_at };
      byName[k].orders++; byName[k].spend += Number(o.total);
    });
    return Object.values(byName).sort((a, b) => b.spend - a.spend);
  }

  /* ---------------- public admin API ---------------- */
  const A = {
    LIVE: false, money, esc,
    role: null, email: null,

    /* ---- auth ---- */
    async signIn(email, password) {
      if (!this.LIVE) {
        // demo: any email works; password must be 6+ chars
        if (password.length < 6) throw new Error("Demo mode: password must be at least 6 characters.");
        this.email = email; this.role = "admin";
        LS.set("session", { email, role: "admin" });
        return;
      }
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: adm, error: e2 } = await supabase().from("admins").select("role").eq("user_id", data.user.id).maybeSingle();
      if (e2) throw e2;
      if (!adm) { await supabase().auth.signOut(); throw new Error("This account is not an admin."); }
      this.role = adm.role; this.email = email;
    },
    async restoreSession() {
      if (!this.LIVE) {
        const s = LS.get("session", null);
        if (s) { this.email = s.email; this.role = s.role; }
        return;
      }
      const { data: { user } } = await supabase().auth.getUser();
      if (!user) return;
      const { data: adm } = await supabase().from("admins").select("role").eq("user_id", user.id).maybeSingle();
      if (adm) { this.role = adm.role; this.email = user.email; }
    },
    async signOut() {
      if (this.LIVE) await supabase().auth.signOut();
      localStorage.removeItem("fba_session");
      this.role = null; this.email = null;
    },
    requireRole(roles) {
      if (!this.role || (roles && !roles.includes(this.role))) throw new Error("Your role doesn't permit that action.");
    },

    /* ---- overview ---- */
    async overview() {
      let orders;
      if (!this.LIVE) orders = demoOrders();
      else {
        const { data, error } = await supabase().from("orders").select("*").order("created_at", { ascending: false }).limit(500);
        if (error) throw error; orders = data;
      }
      const paid = orders.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");
      const today = new Date().setHours(0, 0, 0, 0);
      const rev = paid.reduce((s, o) => s + Number(o.total), 0);
      const todayPaid = paid.filter((o) => new Date(o.created_at).setHours(0, 0, 0, 0) === today);
      const yesterday = new Date(today - 86400000).setHours(0, 0, 0, 0);
      const yPaid = paid.filter((o) => { const d = new Date(o.created_at).setHours(0, 0, 0, 0); return d === yesterday; });
      // 14-day revenue series
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        days.push({ key, label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), revenue: 0, orders: 0 });
      }
      const byKey = Object.fromEntries(days.map((d) => [d.key, d]));
      paid.forEach((o) => { const k = (o.created_at || "").slice(0, 10); if (byKey[k]) { byKey[k].revenue += Number(o.total); byKey[k].orders++; } });
      // top products
      const prodCount = {};
      orders.forEach((o) => (o.items || []).forEach((i) => {
        prodCount[i.product_name] = prodCount[i.product_name] || { name: i.product_name, qty: 0, revenue: 0 };
        prodCount[i.product_name].qty += i.quantity;
        prodCount[i.product_name].revenue += Number(i.line_total ?? i.unit_price * i.quantity);
      }));
      const top = Object.values(prodCount).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      return {
        revenue: rev,
        todayRevenue: todayPaid.reduce((s, o) => s + Number(o.total), 0),
        todayOrders: todayPaid.length,
        yesterdayOrders: yPaid.length,
        aov: paid.length ? rev / paid.length : 0,
        pending: orders.filter((o) => ["received", "preparing"].includes(o.status)).length,
        recent: orders.slice(0, 6),
        series: days, top,
        totalOrders: orders.length,
      };
    },

    /* ---- orders ---- */
    async orders(status) {
      if (!this.LIVE) {
        let list = demoOrders();
        if (status && status !== "all") list = list.filter((o) => o.status === status);
        return list;
      }
      let q = supabase().from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(300);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error; return data;
    },
    async updateOrder(id, patch) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) {
        const list = LS.get("orders", null) || demoOrders();
        const o = list.find((x) => x.id === id);
        if (o) Object.assign(o, patch);
        LS.set("orders", list); return;
      }
      const { error } = await supabase().from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    async deleteOrder(id) {
      this.requireRole(["admin"]);
      if (!this.LIVE) { LS.set("orders", (LS.get("orders", null) || demoOrders()).filter((o) => o.id !== id)); return; }
      const { error } = await supabase().from("orders").delete().eq("id", id);
      if (error) throw error;
    },

    /* ---- products / categories ---- */
    async products() {
      if (!this.LIVE) return LS.get("products", [
        { id: "p1", slug: "pancake-box", name: "Pancake Box", price: 250, category_id: "c1", description: "The everyday classic: a warm pancake, potato salad, scrambled egg, sausage, sesame roll and garnish.", image_url: "assets/img/pancake.jpg", is_featured: true, is_best_seller: true, is_active: true, sort_order: 1 },
        { id: "p2", slug: "fusion-box", name: "Fusion Box", price: 350, category_id: "c3", description: "A fuller spread with a folded omelette instead of scrambled egg, plus sausage, sesame roll and garnish.", image_url: "assets/img/fusion.jpg", is_featured: true, is_best_seller: true, is_active: true, sort_order: 2 },
        { id: "p3", slug: "classic-box", name: "Classic Box", price: 300, category_id: "c2", description: "The full box, gift-wrapped and ribbon-finished — ready to hand straight to whoever it's for.", image_url: "assets/img/classic.jpg", is_featured: true, is_best_seller: false, is_active: true, sort_order: 3 },
      ]);
      const { data, error } = await supabase().from("products").select("*, categories(name)").order("sort_order");
      if (error) throw error; return data;
    },
    async saveProduct(p) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) {
        const list = LS.get("products", null) || (await A._seedProducts());
        if (p.id) { const i = list.findIndex((x) => x.id === p.id); list[i] = { ...list[i], ...p }; }
        else { p.id = "np" + Date.now(); p.slug = p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); list.push(p); }
        LS.set("products", list); return;
      }
      const { id, categories, ...row } = p;
      const { error } = await (id ? supabase().from("products").update(row).eq("id", id) : supabase().from("products").insert(row));
      if (error) throw error;
    },
    async deleteProduct(id) {
      this.requireRole(["admin"]);
      if (!this.LIVE) { const l = LS.get("products", null) || (await A._seedProducts()); LS.set("products", l.filter((p) => p.id !== id)); return; }
      const { error } = await supabase().from("products").delete().eq("id", id);
      if (error) throw error;
    },
    async _seedProducts() { const p = await this.products(); LS.set("products", p); return p; },

    async categories() {
      if (!this.LIVE) return LS.get("cats", [
        { id: "c1", slug: "breakfast-boxes", name: "Breakfast Boxes", description: "The signature warm morning boxes", sort_order: 1 },
        { id: "c2", slug: "gift-boxes", name: "Gift Boxes", description: "Gift-wrapped and ribbon-finished", sort_order: 2 },
        { id: "c3", slug: "combos", name: "Combos", description: "Fuller spreads for sharing", sort_order: 3 },
      ]);
      const { data, error } = await supabase().from("categories").select("*").order("sort_order");
      if (error) throw error; return data;
    },
    async saveCategory(c) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) {
        const list = LS.get("cats", null) || (await this.categories());
        if (c.id) { const i = list.findIndex((x) => x.id === c.id); list[i] = { ...list[i], ...c }; }
        else { c.id = "nc" + Date.now(); c.slug = c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); list.push(c); }
        LS.set("cats", list); return;
      }
      const { error } = await (c.id ? supabase().from("categories").update(c).eq("id", c.id) : supabase().from("categories").insert(c));
      if (error) throw error;
    },
    async deleteCategory(id) {
      this.requireRole(["admin"]);
      if (!this.LIVE) { LS.set("cats", (LS.get("cats", null) || (await this.categories())).filter((c) => c.id !== id)); return; }
      const { error } = await supabase().from("categories").delete().eq("id", id);
      if (error) throw error;
    },

    /* ---- customers ---- */
    async customers() {
      if (!this.LIVE) return demoCustomers();
      const { data, error } = await supabase().from("customers").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error; return data;
    },

    /* ---- reviews ---- */
    async reviews(status) {
      let list = this._demoReviews();
      if (status && status !== "all") list = list.filter((r) => r.status === status);
      return list;
    },
    _demoReviews() {
      return LS.get("reviews", [
        { id: "r1", product_id: "p1", author_name: "Afia N.", rating: 5, title: "Perfect mornings", body: "The pancake box has become my Saturday ritual. Warm, neat and always on time.", status: "pending", created_at: new Date().toISOString() },
      ]);
    },
    async updateReview(id, patch) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) {
        const list = this._demoReviews();
        const r = list.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
        LS.set("reviews", list); return;
      }
      const { error } = await supabase().from("reviews").update(patch).eq("id", id);
      if (error) throw error;
    },
    async deleteReview(id) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) { LS.set("reviews", this._demoReviews().filter((r) => r.id !== id)); return; }
      const { error } = await supabase().from("reviews").delete().eq("id", id);
      if (error) throw error;
    },

    /* ---- coupons ---- */
    async coupons() {
      if (!this.LIVE) return LS.get("coupons", [
        { id: "k1", code: "WELCOME10", discount_type: "percent", discount_value: 10, min_order: 200, used_count: 23, is_active: true, expires_at: null },
        { id: "k2", code: "GIFT50", discount_type: "fixed", discount_value: 50, min_order: 300, used_count: 4, is_active: true, expires_at: null },
      ]);
      const { data, error } = await supabase().from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    async saveCoupon(c) {
      this.requireRole(["admin", "manager"]);
      c.code = (c.code || "").toUpperCase().trim();
      if (!this.LIVE) {
        const list = LS.get("coupons", null) || (await this.coupons());
        if (c.id) { const i = list.findIndex((x) => x.id === c.id); list[i] = { ...list[i], ...c }; }
        else { c.id = "nc" + Date.now(); list.unshift(c); }
        LS.set("coupons", list); return;
      }
      const { error } = await (c.id ? supabase().from("coupons").update(c).eq("id", c.id) : supabase().from("coupons").insert(c));
      if (error) throw error;
    },
    async deleteCoupon(id) {
      this.requireRole(["admin"]);
      if (!this.LIVE) { LS.set("coupons", (LS.get("coupons", null) || (await this.coupons())).filter((c) => c.id !== id)); return; }
      const { error } = await supabase().from("coupons").delete().eq("id", id);
      if (error) throw error;
    },

    /* ---- settings (delivery / content / homepage / seo) ---- */
    async getSettings() {
      if (!this.LIVE) {
        const base = {
          site: { name: "Flutter Batter", tagline: "Breakfast boxes, gift-wrapped", whatsapp: "233201234567", email: "hello@flutterbatter.com", instagram: "https://instagram.com/flutterbatter" },
          delivery: { zones: [
            { name: "Accra Central", fee: 20, eta: "30–45 min" }, { name: "East Accra", fee: 25, eta: "40–55 min" },
            { name: "North Accra", fee: 25, eta: "40–55 min" }, { name: "West Accra", fee: 30, eta: "45–60 min" },
            { name: "Tema & Adenta", fee: 40, eta: "60–80 min" }], hours: "Mon–Sat 6:30am–11:00am", note: "Orders placed after 10:30am are delivered the next morning." },
          homepage: { hero_heading: "Good mornings, boxed to be given.", hero_sub: "Warm breakfast boxes, gift-wrapped and delivered across Accra.",
            sections: { hero: true, featured: true, best_sellers: true, how_it_works: true, testimonials: true, stats: true, coverage_map: true, faq: true, instagram: true, cta: true } },
          seo: { title: "Flutter Batter — Breakfast Boxes, Gift-Wrapped | Accra", description: "Warm breakfast boxes and gift-wrapped brunch delivered across Accra.", keywords: "breakfast delivery accra, gift box ghana" },
        };
        const over = LS.get("settings", {});
        for (const k of Object.keys(over)) base[k] = { ...base[k], ...over[k] };
        return base;
      }
      const { data, error } = await supabase().from("settings").select("key,value");
      if (error) throw error;
      const out = {};
      (data || []).forEach((r) => (out[r.key] = r.value));
      return out;
    },
    async saveSetting(key, value) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) { const o = LS.get("settings", {}); o[key] = value; LS.set("settings", o); return; }
      const { error } = await supabase().from("settings").upsert({ key, value });
      if (error) throw error;
    },

    /* ---- notifications ---- */
    async notifications() {
      if (!this.LIVE) return LS.get("notifs", []);
      const { data, error } = await supabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error; return data;
    },
    async sendNotification(n) {
      this.requireRole(["admin", "manager"]);
      if (!this.LIVE) {
        const list = LS.get("notifs", []);
        list.unshift({ id: "n" + Date.now(), created_at: new Date().toISOString(), ...n, _demo: true });
        LS.set("notifs", list);
        return { sent: 0, demo: true };
      }
      const { error } = await supabase().from("notifications").insert(n);
      if (error) throw error;
      // actual push delivery is delegated to the send-notification edge function
      let sent = 0;
      try {
        const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}` },
          body: JSON.stringify(n),
        });
        const j = await r.json().catch(() => ({}));
        sent = j.sent ?? 0;
      } catch {}
      return { sent };
    },
  };

  A.LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  window.FBA = A;
})();
