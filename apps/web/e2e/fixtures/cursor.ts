import { test as base } from '@playwright/test';

// Headless Chromium doesn't render a real cursor in recorded video,
// which makes the demo videos confusing — viewers see clicks and form
// fills happen with no visible pointer. This fixture injects a fake
// cursor element that tracks mousemove + flashes on click, so the
// recording shows a clear visible pointer at all times.
//
// The cursor is a 24px black dot with a soft white halo, big enough to
// read on 720p playback. Click events trigger a brief radial ripple so
// the click moment is obvious in the recording.
//
// Implementation: `addInitScript` runs the injection on every new page
// + every navigation, so the cursor persists across redirects and
// new contexts.

const CURSOR_SCRIPT = `
(() => {
  if (window.__playwrightCursorInjected) return;
  window.__playwrightCursorInjected = true;

  const STYLES = \`
    .__pwcursor {
      position: fixed !important;
      top: 0; left: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(20, 20, 24, 0.95);
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow:
        0 0 0 2px rgba(0, 0, 0, 0.15),
        0 6px 12px rgba(0, 0, 0, 0.25);
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-50%, -50%);
      transition: transform 60ms linear;
    }
    .__pwcursor-ripple {
      position: fixed !important;
      top: 0; left: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 3px solid rgba(59, 130, 246, 0.9);
      pointer-events: none;
      z-index: 2147483646;
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
      transition: transform 380ms ease-out, opacity 380ms ease-out;
    }
  \`;

  // Track mouse coords even before the DOM mounts the cursor element.
  let lastX = window.innerWidth / 2;
  let lastY = window.innerHeight / 2;
  let cursorEl = null;
  let styleEl = null;

  function applyCursorPosition() {
    if (!cursorEl) return;
    cursorEl.style.left = lastX + 'px';
    cursorEl.style.top = lastY + 'px';
  }

  // Listen at the document level for any pointer event we can hook,
  // even before the body exists. Playwright synthesizes these via CDP
  // before each .click() / .fill() / .hover().
  ['mousemove', 'pointermove', 'mousedown', 'pointerdown'].forEach((evt) => {
    document.addEventListener(evt, (e) => {
      if (e.clientX !== undefined) lastX = e.clientX;
      if (e.clientY !== undefined) lastY = e.clientY;
      applyCursorPosition();
      if (evt === 'mousedown' || evt === 'pointerdown') {
        flashRipple(lastX, lastY);
      }
    }, true);
  });

  function flashRipple(x, y) {
    const parent = document.body || document.documentElement;
    if (!parent) return;
    const ripple = document.createElement('div');
    ripple.className = '__pwcursor-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    parent.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(-50%, -50%) scale(2.6)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 400);
  }

  function mount() {
    if (cursorEl && cursorEl.isConnected) return;
    if (!document.documentElement) return;

    // Stylesheet first — works against <head> or <html> directly.
    if (!styleEl || !styleEl.isConnected) {
      styleEl = document.createElement('style');
      styleEl.textContent = STYLES;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    // Mount the cursor onto body if available, else onto <html>.
    // Fixed positioning works in either parent.
    cursorEl = document.createElement('div');
    cursorEl.className = '__pwcursor';
    cursorEl.style.left = lastX + 'px';
    cursorEl.style.top = lastY + 'px';
    (document.body || document.documentElement).appendChild(cursorEl);
  }

  // addInitScript runs at document_start — too early for body. Try
  // mounting NOW, then again on DOMContentLoaded and load. Whichever
  // fires first wins; subsequent calls early-return.
  mount();
  document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('load', mount);

  // Next.js + RSC can swap the body element on navigation. Watch the
  // document tree and re-mount if our cursor falls out.
  const observer = new MutationObserver(() => {
    if (!cursorEl || !cursorEl.isConnected) mount();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
`;

// Extends the standard test to inject the cursor on every page.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(CURSOR_SCRIPT);
    // Also inject on the live page (addInitScript only fires on navigation).
    await page.evaluate(CURSOR_SCRIPT).catch(() => {});

    // Mirror the same script onto any new pages opened via
    // context.newPage() — used by specs that consume magic-links in
    // a second browser context.
    page.context().on('page', async (newPage) => {
      try {
        await newPage.addInitScript(CURSOR_SCRIPT);
      } catch {
        // Page may close before init runs.
      }
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
