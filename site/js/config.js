/* Flutter Batter — site configuration.
   EDIT THESE after creating your Supabase project (see DEPLOY.md).
   - SUPABASE_URL + SUPABASE_ANON_KEY: leave blank to run in DEMO mode
     (local sample data, no accounts, no real payments).
   - PAYSTACK_PUBLIC_KEY: already the live public key (safe to expose).
   - OneSignal App ID: safe to expose. Only loads on https. */
window.FB_CONFIG = {
  SUPABASE_URL: "https://bmcahanysxvwsquqymgc.supabase.co",            // e.g. "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_DgmckL4fpkgLVaT8en1zYQ_Ge25UnOW",       // the anon/public key (NEVER the service key)

  BRAND: "Flutter Batter",
  CURRENCY: "GH₵",
  WHATSAPP: "233201234567",
  EMAIL: "hello@flutterbatter.com",
  INSTAGRAM: "https://instagram.com/flutterbatter",
  PAYSTACK_PUBLIC_KEY: "pk_live_640c2c23c3255a2a26e8e58a7c0dc2af50cb181c",
  ONESIGNAL_APP_ID: "221203b8-d594-4f73-8763-25dcd7bde7ac",

  get LIVE() { return !!(this.SUPABASE_URL && this.SUPABASE_ANON_KEY); },
};
