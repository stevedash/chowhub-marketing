/* ════════════════════════════════════════════════════════════════
   scroll-fx.js — Umano-style motion layer for the ChowHub homepage.
   Scoped to .home-v2. Progressive enhancement: with JS off (or reduced
   motion) everything is fully visible and static.

   Provides:
     1. Lenis smooth-scroll (momentum/easing) when the lib is present.
     2. Scroll-linked word-fill reveal on [data-fill] headlines/statements
        (words go dim → solid as you scroll through them).
     3. Block fade-up reveal for eyebrow/sub/shot (kept from the old script).
     4. Desktop hero-device scale-on-scroll.
     5. Floating-nav shadow on scroll.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.querySelector('.home-v2');
  if (!root) return;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 880px)').matches;

  // ── 1. Floating nav shadow (works regardless of motion prefs) ──────
  var nav = document.getElementById('siteNav');
  function navShadow() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 12); }
  navShadow();
  window.addEventListener('scroll', navShadow, { passive: true });

  if (reduce) return; // honor reduced-motion: no reveals, no smooth scroll

  // ── 2. Lenis smooth scroll (optional dependency) ───────────────────
  var lenis = null;
  if (window.Lenis && !isMobile) {
    try {
      lenis = new window.Lenis({
        lerp: 0.1,
        smoothWheel: true,
        wheelMultiplier: 1,
      });
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      lenis.on('scroll', schedule);
    } catch (e) { lenis = null; }
  }

  // ── 3. Word-fill: split [data-fill] text into word spans ───────────
  // Walks child nodes so <br> and <span class="highlight"> are preserved
  // (highlight words inherit the highlight colour). Returns the ordered
  // list of word spans for the scroll-linked stagger.
  function splitWords(el) {
    var words = [];
    function walk(node, sink) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (child) {
        if (child.nodeType === 3) { // text
          var parts = child.textContent.split(/(\s+)/);
          parts.forEach(function (p) {
            if (p === '') return;
            if (/^\s+$/.test(p)) { sink.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w';
            w.textContent = p;
            sink.appendChild(w);
            words.push(w);
          });
        } else if (child.nodeName === 'BR') {
          sink.appendChild(child.cloneNode(false));
        } else { // element (e.g. .highlight) — recurse, keep the wrapper
          var clone = child.cloneNode(false);
          sink.appendChild(clone);
          walk(child, clone);
        }
      });
    }
    var frag = document.createElement('span');
    frag.style.display = 'contents';
    walk(el, frag);
    el.innerHTML = '';
    el.appendChild(frag);
    return words;
  }

  var fills = [];
  Array.prototype.forEach.call(document.querySelectorAll('.home-v2 [data-fill]'), function (el) {
    fills.push({ el: el, words: splitWords(el) });
  });
  if (fills.length) root.classList.add('fill-ready');

  // Each word's opacity is driven directly by scroll position (no CSS
  // transition — the scroll IS the timeline). A FEATHER of several words
  // makes the dim→solid edge a soft gradient rather than a hard wipe.
  var FLOOR = 0.16;       // dim words sit at 16% opacity
  var FEATHER = 5;        // words in the gradient edge

  function paintFill(item) {
    var rect = item.el.getBoundingClientRect();
    var vh = window.innerHeight;
    // Progress: 0 when the block's top first peeks in at the viewport bottom,
    // 1 only once its top has risen to ~22% — a long runway so the left→right
    // fill plays out gradually instead of snapping shut.
    var start = vh * 1.0, end = vh * 0.22;
    var p = (start - rect.top) / (start - end);
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    var n = item.words.length;
    var lead = p * (n + FEATHER);
    for (var i = 0; i < n; i++) {
      var t = (lead - i) / FEATHER;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      item.words[i].style.opacity = (FLOOR + (1 - FLOOR) * t).toFixed(3);
    }
  }

  // ── 4. Hero device scale-on-scroll (desktop only) ──────────────────
  var heroDevice = !isMobile ? document.querySelector('.home-v2 .scene-hero .hero-device-inner') : null;
  var heroScene = document.querySelector('.home-v2 .scene-hero');
  function paintHero() {
    if (!heroDevice || !heroScene) return;
    var h = heroScene.offsetHeight || window.innerHeight;
    var sc = window.scrollY;
    var p = Math.min(Math.max(sc / h, 0), 1);
    // grow subtly + drift up a touch as you leave the hero
    var scale = 1 + p * 0.10;
    var ty = p * -18;
    heroDevice.style.transform = 'translateX(4%) translateY(' + ty.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
  }

  // ── Single rAF-throttled update for fills + hero ───────────────────
  var ticking = false;
  function update() {
    ticking = false;
    for (var i = 0; i < fills.length; i++) paintFill(fills[i]);
    paintHero();
  }
  function schedule() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  if (!lenis) window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  schedule();

  // ── 5. Block fade-up reveal for non-fill children ──────────────────
  var scenes = document.querySelectorAll('.home-v2 .scene-inner');
  if ('IntersectionObserver' in window && scenes.length) {
    root.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var kids = e.target.children, delay = 0;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].hasAttribute('data-fill')) continue; // word-fill owns these
          kids[i].style.transitionDelay = (delay * 90) + 'ms';
          kids[i].classList.add('in');
          delay++;
        }
        io.unobserve(e.target);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    scenes.forEach(function (s) {
      if (isMobile && s.closest('.scene--green')) return; // mobile hero has its own entrance
      io.observe(s);
    });
  }
})();
