/* Shared inner-page helpers: footer + page JS registration */
window.FB_page = {
  handlers: [],
  on(fn) { this.handlers.push(fn); },
  run() { this.handlers.forEach((fn) => fn()); },
};
document.addEventListener("DOMContentLoaded", async () => {
  try { window.FB_renderFooter(await window.FB.settings()); } catch {}
  window.FB_page.run();
});
