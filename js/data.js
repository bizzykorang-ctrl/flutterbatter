/* Flutter Batter — data layer.
   One API for the whole site. Two backends:
   - DEMO (no Supabase keys): local seed, localStorage persistence for
     orders/reviews/coupons. Fully browsable offline.
   - LIVE (keys set): supabase-js v2 from CDN, RLS-secured.
   Pages never talk to a backend directly — always through FB. */
(function () {
  "use strict";
  const CFG = window.FB_CONFIG;

  /* ---------------- demo seed ---------------- */
  const DEMO = {
    categories: [
      { id: "c1", slug: "breakfast-boxes", name: "Breakfast Boxes", description: "The signature warm morning boxes", sort_order: 1 },
      { id: "c2", slug: "gift-boxes", name: "Gift Boxes", description: "Gift-wrapped and ribbon-finished", sort_order: 2 },
      { id: "c3", slug: "combos", name: "Combos", description: "Fuller spreads for sharing", sort_order: 3 },
    ],
    products: [
      { id: "p1", slug: "pancake-box", name: "Pancake Box", category_id: "c1", price: 250.00,
        description: "The everyday classic: a warm pancake, potato salad, scrambled egg, sausage, sesame roll and garnish — boxed to travel well.",
        image_url: "assets/img/pancake.jpg", is_featured: true, is_best_seller: true, is_active: true, sort_order: 1,
        ingredients: "Pancake, potato salad, scrambled egg, sausage, sesame roll, garnish" },
      { id: "p2", slug: "fusion-box", name: "Fusion Box", category_id: "c3", price: 350.00,
        description: "A fuller spread with a folded omelette instead of scrambled egg, plus sausage, sesame roll and garnish — our most generous box.",
        image_url: "assets/img/fusion.jpg", is_featured: true, is_best_seller: true, is_active: true, sort_order: 2,
        ingredients: "Folded omelette, sausage, sesame roll, garnish, house sauce" },
      { id: "p3", slug: "classic-box", name: "Classic Box", category_id: "c2", price: 300.00,
        description: "The full box, gift-wrapped and ribbon-finished — ready to hand straight to whoever it's for, no extra wrapping needed.",
        image_url: "assets/img/classic.jpg", is_featured: true, is_best_seller: false, is_active: true, sort_order: 3,
        ingredients: "Full breakfast spread, gift wrap, ribbon finish" },
    ],
    reviews: [
      { id: "r1", product_id: "p1", author_name: "Ama A.", rating: 5, title: "My go-to Saturday treat", body: "The box arrived warm and beautifully packed. The pancake was still soft and the egg perfect. Ordering was effortless.", status: "approved", is_featured: true, created_at: "2026-08-30T09:00:00Z" },
      { id: "r2", product_id: "p2", author_name: "Kwesi D.", rating: 5, title: "Worth every cedi", body: "Ordered the Fusion Box for my sister's birthday — she called me before the rider even left. The gift wrap is genuinely lovely.", status: "approved", is_featured: true, created_at: "2026-09-02T10:00:00Z" },
      { id: "r3", product_id: "p3", author_name: "Nana A.", rating: 4, title: "Great gifting option", body: "Clean presentation and quick delivery to Madina. Would love a slightly bigger sausage, but the whole experience felt premium.", status: "approved", is_featured: true, created_at: "2026-09-05T08:00:00Z" },
    ],
    coupons: [
      { id: "k1", code: "WELCOME10", discount_type: "percent", discount_value: 10, min_order: 200, is_active: true, expires_at: null },
      { id: "k2", code: "GIFT50", discount_type: "fixed", discount_value: 50, min_order: 300, is_active: true, expires_at: null },
    ],
    settings: {
      site: { name: "Flutter Batter", tagline: "Breakfast boxes, gift-wrapped", whatsapp: CFG.WHATSAPP, email: CFG.EMAIL, instagram: CFG.INSTAGRAM },
      delivery: {
        zones: [
          { name: "Accra Central", fee: 20, eta: "30–45 min" },
          { name: "East Accra", fee: 25, eta: "40–55 min" },
          { name: "North Accra", fee: 25, eta: "40–55 min" },
          { name: "West Accra", fee: 30, eta: "45–60 min" },
          { name: "Tema & Adenta", fee: 40, eta: "60–80 min" },
        ],
        hours: "Mon–Sat 6:30am–11:00am",
        note: "Orders placed after 10:30am are delivered the next morning.",
      },
      stats: { boxes_delivered: 4200, gift_wrapped: 1350, avg_rating: 4.8, areas_covered: 12 },
      seo: {
        title: "Flutter Batter — Breakfast Boxes, Gift-Wrapped | Accra",
        description: "Warm breakfast boxes and gift-wrapped brunch delivered across Accra. Pancake, Fusion and Classic boxes. Order by 10:30am for same-morning delivery.",
      },
      homepage: {
        hero_heading: "Good mornings, boxed to be given.",
        hero_sub: "Warm breakfast boxes, gift-wrapped and delivered across Accra.",
        sections: { hero: true, featured: true, best_sellers: true, how_it_works: true, testimonials: true, stats: true, coverage_map: true, faq: true, instagram: true, cta: true },
      },
      faq: [
        { q: "When do you deliver?", a: "Monday to Saturday, 6:30am to 11:00am. Orders placed after 10:30am are delivered the next morning." },
        { q: "Where do you deliver?", a: "Across Greater Accra — Central, East, North, West, plus Tema and Adenta. Delivery fees by zone are shown at checkout." },
        { q: "How do I pay?", a: "Pay online with Paystack (card, MTN MoMo, Vodafone Cash) or choose cash on delivery." },
        { q: "Can I gift a box?", a: "That's the whole idea. Choose the Classic Box for full gift-wrap and ribbon, and add a note at checkout — we hand-write it." },
        { q: "How do I track my order?", a: "Use the Track Order page with your order number (e.g. FB-20260918-0001). You'll also get a WhatsApp confirmation." },
        { q: "Do you do events or bulk orders?", a: "Yes — WhatsApp us at least 48 hours ahead and we'll prepare a custom quote." },
      ],
    },
  };

  /* ---------------- localStorage (demo persistence) ---------------- */
  const LS = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("fb_" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("fb_" + k, JSON.stringify(v)); } catch {} },
  };

  /* ---------------- Supabase loader (CDN, live mode only) ---------------- */
  let sb = null;
  function supabase() {
    if (sb) return sb;
    if (!window.supabase) throw new Error("supabase-js failed to load");
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    return sb;
  }

  const money = (n) => CFG.CURRENCY + Number(n).toFixed(2).replace(/\.00$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- public API ---------------- */
  const FB = {
    LIVE: false, // set below
    money, esc,

    async categories() {
      if (!this.LIVE) return DEMO.categories;
      const { data, error } = await supabase().from("categories").select("*").order("sort_order");
      if (error) throw error; return data;
    },

    async products(opts = {}) {
      const { categorySlug, search, featured, bestSeller } = opts;
      if (!this.LIVE) {
        let list = DEMO.products.filter((p) => p.is_active);
        if (categorySlug) { const c = DEMO.categories.find((x) => x.slug === categorySlug); if (c) list = list.filter((p) => p.category_id === c.id); }
        if (featured) list = list.filter((p) => p.is_featured);
        if (bestSeller) list = list.filter((p) => p.is_best_seller);
        if (search) { const s = search.toLowerCase(); list = list.filter((p) => (p.name + " " + p.description).toLowerCase().includes(s)); }
        return list.slice().sort((a, b) => a.sort_order - b.sort_order);
      }
      let q = supabase().from("products").select("*, categories(slug,name)").eq("is_active", true).order("sort_order");
      if (categorySlug) q = q.eq("categories.slug", categorySlug); // joined filter
      if (featured) q = q.eq("is_featured", true);
      if (bestSeller) q = q.eq("is_best_seller", true);
      const { data, error } = await q;
      if (error) throw error;
      let list = data || [];
      if (search) { const s = search.toLowerCase(); list = list.filter((p) => (p.name + " " + p.description).toLowerCase().includes(s)); }
      return list;
    },

    async product(slug) {
      if (!this.LIVE) return DEMO.products.find((p) => p.slug === slug) || null;
      const { data, error } = await supabase().from("products").select("*, categories(slug,name)").eq("slug", slug).maybeSingle();
      if (error) throw error; return data;
    },

    async reviews(productId) {
      if (!this.LIVE) return DEMO.reviews.filter((r) => r.status === "approved" && (!productId || r.product_id === productId));
      let q = supabase().from("reviews").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(50);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error; return data;
    },

    async featuredReviews() {
      if (!this.LIVE) return DEMO.reviews.filter((r) => r.is_featured);
      const { data, error } = await supabase().from("reviews").select("*").eq("status", "approved").eq("is_featured", true).limit(6);
      if (error) throw error; return data;
    },

    async addReview(review) {
      if (!this.LIVE) {
        const list = LS.get("reviews", []);
        list.unshift({ id: "lr" + Date.now(), status: "pending", created_at: new Date().toISOString(), ...review });
        LS.set("reviews", list);
        return { ok: true, demo: true };
      }
      const user = await this.user();
      const { error } = await supabase().from("reviews").insert({ ...review, user_id: user?.id ?? null, status: "pending" });
      if (error) throw error;
      return { ok: true };
    },

    async settings() {
      if (!this.LIVE) {
        // demo: allow local overrides (e.g. admin demo edits) merged over seed
        const over = LS.get("settings", {});
        const merged = JSON.parse(JSON.stringify(DEMO.settings));
        for (const k of Object.keys(over)) merged[k] = { ...merged[k], ...over[k] };
        return merged;
      }
      const { data, error } = await supabase().from("settings").select("key,value");
      if (error) throw error;
      const out = {};
      for (const row of data || []) out[row.key] = row.value;
      out.faq = out.faq || DEMO.settings.faq;
      return out;
    },

    async checkCoupon(code, subtotal) {
      code = (code || "").trim().toUpperCase();
      if (!code) return { ok: false, reason: "Enter a code" };
      let c;
      if (!this.LIVE) c = DEMO.coupons.find((x) => x.code === code);
      else {
        const { data, error } = await supabase().from("coupons").select("*").eq("code", code).eq("is_active", true).maybeSingle();
        if (error) throw error; c = data;
      }
      if (!c) return { ok: false, reason: "That code doesn't exist" };
      if (c.expires_at && new Date(c.expires_at) < new Date()) return { ok: false, reason: "That code has expired" };
      if (subtotal < (c.min_order || 0)) return { ok: false, reason: `Requires a ${money(c.min_order)} minimum` };
      const discount = c.discount_type === "percent" ? Math.round(subtotal * c.discount_value) / 100 : Math.min(c.discount_value, subtotal);
      return { ok: true, code: c.code, discount, label: c.discount_type === "percent" ? `${c.discount_value}% off` : `${money(c.discount_value)} off` };
    },

    /* ---------- orders ---------- */
    async placeOrder(payload) {
      // payload: {customer{...}, items[{product_id,name,price,qty}], zone, couponCode, paymentMethod, note}
      const subtotal = payload.items.reduce((s, i) => s + i.price * i.qty, 0);
      const coupon = payload.couponCode ? await this.checkCoupon(payload.couponCode, subtotal) : { ok: false };
      const discount = coupon.ok ? coupon.discount : 0;
      const total = subtotal + payload.zone.fee - discount;
      const order = {
        customer_name: payload.customer.name, customer_phone: payload.customer.phone, customer_email: payload.customer.email || null,
        address_area: payload.zone.name, address_street: payload.customer.street, address_notes: payload.customer.notes || null,
        delivery_fee: payload.zone.fee, subtotal, discount, total,
        coupon_code: coupon.ok ? coupon.code : null,
        payment_method: payload.paymentMethod, payment_status: "pending", status: "received", note: payload.note || null,
      };
      if (!this.LIVE) {
        const list = LS.get("orders", []);
        const d = new Date();
        order.order_number = "FB-" + d.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(list.length + 1).padStart(4, "0");
        order.id = "demo-" + Date.now();
        order.created_at = new Date().toISOString();
        order.items = payload.items.map((i) => ({ product_name: i.name, unit_price: i.price, quantity: i.qty, line_total: i.price * i.qty }));
        list.unshift(order);
        LS.set("orders", list);
        return { ok: true, demo: true, order };
      }
      const user = await this.user();
      const items = payload.items.map((i) => ({ product_id: i.product_id, product_name: i.name, unit_price: i.price, quantity: i.qty, line_total: i.price * i.qty }));
      const { data: o, error } = await supabase().from("orders").insert({ ...order, user_id: user?.id ?? null }).select().single();
      if (error) throw error;
      // order_items insert needs service role → done by paystack-init edge fn in live flow.
      // For cash orders, items are attached by the order-items edge call below.
      if (payload.paymentMethod === "cash") {
        await fetch(`${CFG.SUPABASE_URL}/functions/v1/order-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ order_id: o.id, items }),
        }).catch(() => {});
      }
      return { ok: true, order: o, items };
    },

    async trackOrder(numberOrRef) {
      const s = (numberOrRef || "").trim();
      if (!this.LIVE) {
        const list = LS.get("orders", []);
        const o = list.find((x) => x.order_number === s || x.paystack_reference === s);
        if (!o) return null;
        // demo timeline simulation by age
        const age = (Date.now() - new Date(o.created_at).getTime()) / 60000;
        o.status = o.status === "received" && age > 3 ? (age > 8 ? "dispatched" : "preparing") : o.status;
        return o;
      }
      const col = s.startsWith("FB-") ? "order_number" : "paystack_reference";
      const { data, error } = await supabase().from("orders").select("*, order_items(*)").eq(col, s).maybeSingle();
      if (error) throw error; return data;
    },

    /* ---------- auth (live mode) ---------- */
    async user() {
      if (!this.LIVE) return LS.get("demo_user", null);
      const { data: { user } } = await supabase().auth.getUser();
      return user;
    },
    async signUp(email, password, name, phone) {
      if (!this.LIVE) { LS.set("demo_user", { email, name }); return { ok: true, demo: true }; }
      const { error } = await supabase().auth.signUp({ email, password, options: { data: { full_name: name, phone } } });
      if (error) throw error; return { ok: true };
    },
    async signIn(email, password) {
      if (!this.LIVE) { LS.set("demo_user", { email }); return { ok: true, demo: true }; }
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error; return { ok: true };
    },
    async signOut() {
      if (!this.LIVE) { localStorage.removeItem("fb_demo_user"); return; }
      await supabase().auth.signOut();
    },
    onAuth(cb) {
      if (!this.LIVE) return;
      supabase().auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
    },

    /* ---------- my orders / addresses (live mode; demo falls back locally) ---------- */
    async myOrders() {
      if (!this.LIVE) return LS.get("orders", []).filter((o) => o.customer_email === LS.get("demo_user", {})?.email);
      const { data, error } = await supabase().from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
    async addresses() {
      if (!this.LIVE) return LS.get("addresses", []);
      const { data, error } = await supabase().from("addresses").select("*").order("is_default", { ascending: false });
      if (error) throw error; return data;
    },
    async saveAddress(a) {
      if (!this.LIVE) { const l = LS.get("addresses", []); a.id = a.id || "a" + Date.now(); const i = l.findIndex((x) => x.id === a.id); i >= 0 ? l[i] = a : l.unshift(a); LS.set("addresses", l); return; }
      if (a.id) { const { error } = await supabase().from("addresses").update(a).eq("id", a.id); if (error) throw error; }
      else { const { error } = await supabase().from("addresses").insert(a); if (error) throw error; }
    },
    async deleteAddress(id) {
      if (!this.LIVE) { LS.set("addresses", LS.get("addresses", []).filter((x) => x.id !== id)); return; }
      const { error } = await supabase().from("addresses").delete().eq("id", id); if (error) throw error;
    },

    /* ---------- admin demo-state bridge (used by admin dashboard demo mode) ---------- */
    _demo: DEMO,
  };

  FB.LIVE = CFG.LIVE && !!window.supabase;
  window.FB = FB;
})();
