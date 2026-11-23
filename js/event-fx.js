/* Quiet ambient motion on each event card, in that event's own flowers and colours:
   Mehendi: marigold petals and warm sparkles · Baraat: rose petals and gold glints · Walima: jasmine blossoms and rising pearl light.
   Runs only while a card is on screen; off for anyone who prefers reduced motion. */
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const THEMES = {
    mehendi: { fall: ["#F6B93B", "#EE9A1F", "#F9D56E", "#E8741C"], kind: "marigold", n: 9, glow: ["#FFE7A3", "#F6C453"], spark: "star" },
    baraat:  { fall: ["#C23B52", "#D9657A", "#F0A3B0", "#8E1F3A"], kind: "rose", n: 9, glow: ["#FFE3B0", "#D9A441"], spark: "star" },
    walima:  { fall: ["#FFFFFF", "#FFF6E0", "#F5EBD0"], kind: "jasmine", n: 8, glow: ["#E6FBF6", "#9FD8CC"], spark: "orb" }
  };
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];

  function shapes(x, kind, s, col) {
    if (kind === "jasmine") { x.fillStyle = col; for (let i = 0; i < 5; i++) { x.rotate(1.2566); x.beginPath(); x.ellipse(0, -s * .55, s * .32, s * .55, 0, 0, 6.29); x.fill(); } x.fillStyle = "#E9C36A"; x.beginPath(); x.arc(0, 0, s * .2, 0, 6.29); x.fill(); return; }
    x.fillStyle = col; x.beginPath();
    if (kind === "rose") { x.moveTo(0, -s); x.bezierCurveTo(s, -s * .8, s * .9, s * .7, 0, s); x.bezierCurveTo(-s * .9, s * .7, -s, -s * .8, 0, -s); }
    else { x.moveTo(0, -s); x.quadraticCurveTo(s * .75, -s * .1, 0, s); x.quadraticCurveTo(-s * .75, -s * .1, 0, -s); }   // marigold: narrow pointed petal
    x.fill();
  }

  function mount(card) {
    const ev = card.closest(".event"), th = THEMES[ev && ev.dataset.event]; if (!th) return;
    const c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3";
    card.appendChild(c); const x = c.getContext("2d");
    let W = 0, H = 0, D = 1, run = false, last = 0, P = [], S = [];
    const petal = (top) => ({ x: rnd(0, W), y: top ? rnd(-30, -6) : rnd(0, H), s: rnd(5, 9) * (W / 340), col: pick(th.fall), vy: rnd(14, 28), sw: rnd(8, 20), p: rnd(0, 6.3), f: rnd(.5, 1.1), r: rnd(0, 6.3), vr: rnd(-1, 1), a: rnd(.55, .85) });
    const spark = () => ({ x: rnd(.06, .94) * W, y: rnd(.04, .96) * H, s: rnd(2, 4.5) * (W / 340), t: rnd(0, 6.3), v: rnd(.8, 1.8), col: pick(th.glow), vy: th.spark === "orb" ? -rnd(4, 9) : 0 });
    function size() { D = Math.min(devicePixelRatio || 1, 2); W = card.clientWidth; H = card.clientHeight; c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
      P = Array.from({ length: th.n }, () => petal(false)); S = Array.from({ length: 9 }, spark); }
    new ResizeObserver(size).observe(card); size();
    function frame(t) { if (!run) return; const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; x.clearRect(0, 0, W, H);
      S.forEach(q => { q.t += q.v * dt; q.y += q.vy * dt; if (q.y < -8) { q.y = H + 8; q.x = rnd(.06, .94) * W; }
        const a = Math.max(0, Math.sin(q.t)) ** 2; if (a < .02) return; x.save(); x.translate(q.x, q.y); x.globalAlpha = a * .9; x.fillStyle = q.col;
        if (th.spark === "orb") { const g = x.createRadialGradient(0, 0, 0, 0, 0, q.s * 2.4); g.addColorStop(0, q.col); g.addColorStop(1, "transparent"); x.fillStyle = g; x.beginPath(); x.arc(0, 0, q.s * 2.4, 0, 6.29); x.fill(); }
        else { x.beginPath(); const r = q.s * 1.8, k = .28; x.moveTo(0, -r); x.quadraticCurveTo(k * r, -k * r, r, 0); x.quadraticCurveTo(k * r, k * r, 0, r); x.quadraticCurveTo(-k * r, k * r, -r, 0); x.quadraticCurveTo(-k * r, -k * r, 0, -r); x.fill(); }
        x.restore(); });
      P.forEach((p, i) => { p.y += p.vy * dt; p.p += p.f * dt * 3; p.x += Math.sin(p.p) * p.sw * dt; p.r += p.vr * dt;
        if (p.y > H + 20) { P[i] = petal(true); return; }
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.max(.3, Math.abs(Math.cos(p.p * .7)))); x.globalAlpha = p.a; shapes(x, th.kind, p.s, p.col); x.restore(); });
      requestAnimationFrame(frame); }
    new IntersectionObserver(es => { const on = es[0].isIntersecting; if (on && !run) { run = true; last = performance.now(); requestAnimationFrame(frame); } else if (!on) run = false; }, { threshold: .05 }).observe(card);
  }
  const go = () => document.querySelectorAll(".ev-card").forEach(mount);
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", go) : go();
})();
