/* =====================================================================
   Signature — writes the guest's name in Playwrite BE VLG (Google Fonts), revealed left to right
   the way a pen moves, in 18k gold with the shared glint.
   Usage: Signature.write(el, "Imran and family", { size: 24 }) → Promise (resolves when written)
   size = cap height in px (the font size is derived from it); weight is kept for compatibility.
   ===================================================================== */
(function () {
  const FAMILY = '"Great Vibes"';
  const PER_CHAR = 210, MAX = 4260, MIN = 1200;   // writing time: ~210ms a letter, within these bounds (ms) — half speed
  const running = new WeakMap();
  const fontSize = size => Math.round(size * 1.18) - 10;   // 10px smaller than the first pass
  const ready = size => (document.fonts?.load ? document.fonts.load(`400 ${fontSize(size)}px ${FAMILY}`).catch(() => {}) : Promise.resolve());

  // cubic-bezier(.35,.05,.45,1): the pen starts gently, moves steadily, and eases off at the end
  function bezier(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const at = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => { let t = x; for (let i = 0; i < 6; i++) { const d = slope(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (at(t, x1, x2) - x) / d; } return at(Math.min(1, Math.max(0, t)), y1, y2); };
  }
  const EASE = bezier(.35, .05, .45, 1);

  // Reveal a word left to right by driving --sig-p (0% → 100%) frame by frame. Done in script rather than with
  // element.animate() on the custom property, because Safari / iOS WebKit does not animate custom properties
  // through the Web Animations API (the text just popped in at the end). Works the same in every browser.
  function reveal(el, { duration = 1000, delay = 0 } = {}) {
    running.get(el)?.cancel();
    el.style.setProperty("--sig-p", "0%");
    let raf = 0, timer = 0, stop = false, done;
    const p = new Promise(resolve => { done = resolve;
      const start = () => {
        const t0 = performance.now();
        const step = now => {
          if (stop) return resolve(false);
          const k = Math.min(1, (now - t0) / duration);
          el.style.setProperty("--sig-p", (EASE(k) * 100).toFixed(2) + "%");
          if (k < 1) raf = requestAnimationFrame(step); else { running.delete(el); resolve(true); }
        };
        raf = requestAnimationFrame(step);
      };
      delay ? (timer = setTimeout(start, delay)) : start();
    });
    running.set(el, { cancel() { stop = true; cancelAnimationFrame(raf); clearTimeout(timer); running.delete(el); done(false); } });
    return p;
  }
  const durationFor = text => Math.max(MIN, Math.min(MAX, text.length * PER_CHAR));

  function write(el, text, { size = 24, animate = true, delay = 0 } = {}) {
    running.get(el)?.cancel();
    el.textContent = "";
    if (!text) return Promise.resolve();
    const s = document.createElement("span");
    s.className = "signature shimmer-text";
    s.style.fontSize = fontSize(size) + "px";
    s.textContent = text;
    el.append(s);
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return ready(size);
    s.style.setProperty("--sig-p", "0%");
    running.set(el, { cancel() { running.get(s)?.cancel(); } });
    return ready(size).then(() => s.isConnected ? reveal(s, { duration: durationFor(text), delay }) : false)
      .then(() => { if (s.isConnected) s.style.setProperty("--sig-p", "100%"); });
  }
  const stop = el => running.get(el)?.cancel();

  // Write a name that may be too long for one line: whole words wrap onto a second line; past two lines (or a single
  // word wider than the space) the text is cut with an ellipsis. Each line is written in turn, left to right.
  async function writeLines(el, text, { size = 24, animate = true, delay = 0, maxLines = 2 } = {}) {
    running.get(el)?.cancel();
    const job = {}; running.set(el, { cancel() { job.stop = true; el.querySelectorAll(".signature").forEach(stop); } });
    if (!text) { el.textContent = ""; return; }
    await ready(size);
    if (job.stop) return;
    const cs = getComputedStyle(el);
    // the space the name may use: its container's width (the name element itself may shrink to fit its text), less its own padding
    const max = Math.max(40, (el.parentElement || el).clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 300;
    const probe = document.createElement("span");
    probe.className = "signature"; probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;font-size:${fontSize(size)}px`;
    document.body.append(probe);
    const fits = t => { probe.textContent = t; return probe.getBoundingClientRect().width <= max; };
    const clip = t => { if (fits(t)) return t; while (t.length > 1 && !fits(t + "…")) t = t.slice(0, -1).trimEnd(); return t + "…"; };
    const lines = [];
    for (const w of text.trim().split(/\s+/)) {
      const last = lines[lines.length - 1];
      if (last != null && fits(last + " " + w)) lines[lines.length - 1] = last + " " + w;
      else lines.push(fits(w) ? w : clip(w));
    }
    if (lines.length > maxLines) { lines.length = maxLines; let l = lines[maxLines - 1] + "…"; while (!fits(l) && l.length > 2) l = l.slice(0, -2).trimEnd() + "…"; lines[maxLines - 1] = l.replace(/\s+…$/, "…"); }
    probe.remove();
    // build every line at once (still unwritten), so the block takes its final height before the pen starts:
    // nothing below it moves while the name is being written
    const play = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frag = document.createDocumentFragment();
    const words = lines.map(l => {
      const row = document.createElement("span"); row.className = "signature-line";
      const sp = document.createElement("span"); sp.className = "signature shimmer-text"; sp.style.fontSize = fontSize(size) + "px";
      sp.textContent = l; sp.style.setProperty("--sig-p", play ? "0%" : "100%");
      row.append(sp); frag.append(row); return sp;
    });
    el.replaceChildren(frag);
    if (!play) return;
    for (let i = 0; i < words.length; i++) {
      if (job.stop) return;
      await reveal(words[i], { duration: durationFor(lines[i]), delay: i ? 0 : delay });
      if (job.stop) return;
      words[i].style.setProperty("--sig-p", "100%");
    }
  }
  window.Signature = { write, writeLines, ready, reveal, durationFor, stop };
})();
