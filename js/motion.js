/* Flutter Batter — scroll motion pass (v1).
   Loads after data.js, before page scripts. Enhances the existing
   reveal system: auto-stagger cards, image zoom-settle, hero parallax,
   scroll progress bar. All disabled under prefers-reduced-motion. */
(function () {
  "use strict";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", function () {
    if (reduced) return;

    /* 1 · scroll progress bar */
    if (!document.getElementById("fbProgress")) {
      var bar = document.createElement("div");
      bar.id = "fbProgress";
      document.documentElement.appendChild(bar);
    }

    /* 2 · hero parallax (desktop-ish widths only, cheap transform) */
    var hero = document.querySelector(".hero-content");
    var heroMedia = document.querySelector(".hero-media");
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        if (y > 900) { ticking = false; return; }
        if (bar) bar.style.transform = "scaleX(" + Math.min(1, y / (document.body.scrollHeight - innerHeight || 1)) + ")";
        if (hero) hero.style.transform = "translateY(" + y * 0.18 + "px)";
        if (heroMedia) heroMedia.style.transform = "translateY(" + y * 0.08 + "px) scale(" + (1 + y * 0.00012) + ")";
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* 3 · auto-stagger groups that forgot their class */
    ["featuredGrid", "bestSellerGrid", "testimonialGrid", "relatedGrid", "menuGrid", "instaGrid", "zoneList"]
      .forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.classList.contains("stagger")) el.classList.add("stagger");
      });

    /* 4 · zoom-settle on product media when scrolled into view
       (cards are injected after data loads, so rescan lazily) */
    var zio = null;
    if ("IntersectionObserver" in window) {
      zio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("fb-zoom-in");
          zio.unobserve(e.target);
        });
      }, { threshold: 0.18 });
    }
    function armZoomables() {
      if (!zio) return;
      document.querySelectorAll(".product-media img, .pdp-media img, .insta-cell img")
        .forEach(function (i) { if (!i.dataset.fbZoom) { i.dataset.fbZoom = "1"; zio.observe(i); } });
    }
    armZoomables();
    [800, 1800, 3200].forEach(function (ms) { setTimeout(armZoomables, ms); });
    window.FB_ARM_ZOOM = armZoomables;

    /* 5 · section headings slide in */
    document.querySelectorAll(".section-head").forEach(function (h) {
      if (!h.classList.contains("reveal")) h.classList.add("reveal");
    });

    /* 6 · re-arm reveals added after data loads (cards injected later) */
    if ("IntersectionObserver" in window && window.FB_page) {
      var origRun = window.FB_page.run.bind(window.FB_page);
      window.FB_page.run = function () {
        origRun();
        setTimeout(function () {
          document.querySelectorAll(".stagger").forEach(function (g) {
            g.querySelectorAll(":scope > *").forEach(function (c) {
              var r = c.getBoundingClientRect();
              if (r.top < innerHeight) c.style.transitionDelay = "0ms";
            });
          });
          if (window.FB_ARM_ZOOM) window.FB_ARM_ZOOM();
        }, 300);
      };
    }
  });
})();
