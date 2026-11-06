// ==UserScript==
// @name         Songsterr – continue + auto-resume + playhead fix
// @match        https://www.songsterr.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
    const style = document.createElement("style");
    style.textContent = `
      .PdDsXq_controlsBlocker,
      form.w_eHuW_modal,
      form[class*="w_eHuW_modal"],
      .idrtTa_controlsBlurOverlay,
      ._6jiALa_tabBlurOverlay,
      [class*="controlsBlurOverlay"],
      [class*="tabBlurOverlay"] {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  
    let shouldPlay = false;
    let userPaused = false;
    let lastDismiss = 0;
    let resuming = false;
  
    // Keyed by playhead href. Each line has its own <use>, so element identity
    // changes when Songsterr re-renders a line.
    let lastPositions = new Map();
    let activeHeadHref = null;
    const forcedHeads = new Set();
  
    const playBtn = () => document.querySelector("#control-play");
    const isPlaying = () => playBtn()?.getAttribute("aria-pressed") === "true";
    const isPaused = () => playBtn()?.getAttribute("aria-pressed") === "false";
  
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#control-play")) return;
      setTimeout(() => {
        if (isPlaying()) { shouldPlay = true; userPaused = false; }
        else { shouldPlay = false; userPaused = true; }
      }, 50);
    }, true);
  
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space" || e.target.closest("input,textarea")) return;
      setTimeout(() => {
        shouldPlay = isPlaying();
        userPaused = !shouldPlay;
      }, 50);
    }, true);
  
    // Each line owns a playhead: <use href="#cursor-playhead-{line}-{track}">.
    // Its x position is the SVG transform attribute (the old CSS translate3d is
    // gone). When playback wraps, the previous line keeps its last transform and
    // is hidden; the next line is the one whose transform keeps changing.
    // A popup hides every playhead, so force the moving one visible.
    function playheadPosition(h) {
      return h.getAttribute("transform") || h.style.transform || "";
    }

    function releasePlayheads() {
      for (const h of forcedHeads) {
        if (h.isConnected) h.style.removeProperty("visibility");
      }
      forcedHeads.clear();
    }

    function fixPlayhead() {
      const heads = [...document.querySelectorAll('use[href*="cursor-playhead"]')];

      if (!shouldPlay) {
        releasePlayheads();
        return;
      }
      if (!heads.length) return;

      const hrefOf = (h) => h.getAttribute("href");
      const moved = [];

      for (const h of heads) {
        const href = hrefOf(h);
        const pos = playheadPosition(h);
        const prev = lastPositions.get(href);

        // One line moved. A popup often stamps a transform onto every line at once;
        // that burst is not a line change.
        if (prev !== undefined && prev !== pos && pos.includes("translate")) moved.push(h);

        lastPositions.set(href, pos);
      }

      if (moved.length === 1) {
        activeHeadHref = hrefOf(moved[0]);
      } else if (moved.length > 1) {
        const visibleMoved = moved.find((h) => h.style.visibility === "visible");
        if (visibleMoved) activeHeadHref = hrefOf(visibleMoved);
      }

      const activeStillThere = heads.some((h) => hrefOf(h) === activeHeadHref);
      if (!activeHeadHref || !activeStillThere) {
        const visible = heads.filter((h) => h.style.visibility === "visible");
        if (visible.length === 1) activeHeadHref = hrefOf(visible[0]);
        else {
          const positioned = heads.filter((h) => playheadPosition(h).includes("translate"));
          if (positioned.length === 1) activeHeadHref = hrefOf(positioned[0]);
        }
      }

      // Seek or line wrap: Songsterr hides the old playhead and shows the next one
      // before that line's transform has ticked again.
      const revealed = heads.filter((h) => h.style.visibility === "visible");
      if (revealed.length === 1 && hrefOf(revealed[0]) !== activeHeadHref) {
        const activeEl = heads.find((h) => hrefOf(h) === activeHeadHref);
        if (!activeEl || activeEl.style.visibility === "hidden") {
          activeHeadHref = hrefOf(revealed[0]);
        }
      }

      if (!activeHeadHref) return;

      for (const h of heads) {
        const isActive = hrefOf(h) === activeHeadHref;
        h.style.setProperty("visibility", isActive ? "visible" : "hidden", "important");
        forcedHeads.add(h);
      }
    }
  
    // Promo UI mounts under #app, not inside #apptab (including modalWithPick).
    function dismissTarget() {
      const continueLink = document.querySelector(".w_eHuW_continueLink a");
      if (continueLink) return continueLink;

      const promoCta = document.querySelector("[data-promo-ctas] a");
      if (promoCta) return promoCta;

      for (const el of document.querySelectorAll("a, button")) {
        const text = (el.textContent || "").trim();
        if (/continue with sync pauses/i.test(text)) return el;
      }

      // modalWithPick sometimes omits the continue link until picks load.
      if (document.querySelector('form[class*="w_eHuW_modal"]')) {
        for (const btn of document.querySelectorAll("button")) {
          const text = (btn.textContent || "").trim();
          if (/^use synth$/i.test(text)) return btn;
        }
      }

      return null;
    }

    function dismissPopup() {
      const target = dismissTarget();
      if (!target) return;

      const now = Date.now();
      if (now - lastDismiss < 800) return;
      lastDismiss = now;

      target.click();
      // Don't remove DOM nodes — that breaks Songsterr's render state
      setTimeout(fixPlayhead, 0);
      setTimeout(fixPlayhead, 16);
      setTimeout(fixPlayhead, 32);
    }
  
    function resumeIfNeeded() {
      if (resuming || userPaused || !shouldPlay) return;
      const btn = playBtn();
      if (!btn || !isPaused()) return;
  
      resuming = true;
      btn.click();
      setTimeout(() => { resuming = false; }, 50);
    }
  
    function start() {
      dismissPopup();
  
      const root = document.getElementById("app") || document.documentElement;

      new MutationObserver(() => {
        dismissPopup();
        fixPlayhead();
      }).observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });

      setInterval(() => {
        dismissPopup();
        resumeIfNeeded();
        fixPlayhead();
      }, 16);
    }
  
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  })();