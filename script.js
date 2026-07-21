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
      .idrtTa_controlsBlurOverlay,
      ._6jiALa_tabBlurOverlay {
        display: none !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  
    let shouldPlay = false;
    let userPaused = false;
    let lastDismiss = 0;
    let resuming = false;
  
    let lastTransforms = new Map();
    let activeHeadHref = null;
  
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
  
    // Songsterr hides the playhead when the popup opens.
    // The moving one is whichever transform keeps changing — force that one visible.
    function fixPlayhead() {
      if (!shouldPlay) return;
  
      const heads = [...document.querySelectorAll('use[href*="cursor-playhead"]')];
      if (!heads.length) return;
  
      for (const h of heads) {
        const transform = h.style.transform || "";
        const prev = lastTransforms.get(h);
  
        if (prev !== undefined && prev !== transform && transform.includes("translate3d")) {
          activeHeadHref = h.getAttribute("href");
        }
  
        lastTransforms.set(h, transform);
      }
  
      if (!activeHeadHref) {
        const visible = heads.find((h) => getComputedStyle(h).visibility === "visible");
        if (visible) activeHeadHref = visible.getAttribute("href");
      }
  
      if (!activeHeadHref) return;
  
      for (const h of heads) {
        const isActive = h.getAttribute("href") === activeHeadHref;
        h.style.setProperty("visibility", isActive ? "visible" : "hidden", "important");
      }
    }
  
    function dismissPopup() {
      const link = document.querySelector(".w_eHuW_continueLink a");
      if (!link) return;
  
      const now = Date.now();
      if (now - lastDismiss < 800) return;
      lastDismiss = now;
  
      link.click();
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
  
      const root = document.getElementById("apptab") || document.documentElement;
  
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
        resumeIfNeeded();
        fixPlayhead();
      }, 16);
    }
  
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  })();