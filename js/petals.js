/* A few soft petals drifting down the whole invitation, like light through a window. Quiet by design. */
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!(window.INVITE_CONFIG && window.INVITE_CONFIG.sitePetals)) return;   // off by default: set sitePetals: true in config.js to bring the falling petals back
  const c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  document.body.appendChild(c); const x = c.getContext("2d");
  let W = 0, H = 0, D = 1, petals = [], last = 0;
  const COLORS = [["#F9D2D8", "#EFA9B8"], ["#FBE3E4", "#F2B8C2"], ["#FFF1E6", "#F5CBB8"], ["#F6C6D0", "#E391A6"]];
  const make = (top) => { const [a, b] = COLORS[Math.random() * COLORS.length | 0], s = 7 + Math.random() * 9;
    return { x: Math.random() * W, y: top ? -20 - Math.random() * H * .3 : Math.random() * H, s, a, b, vy: 18 + Math.random() * 26, sw: 14 + Math.random() * 26, f: .4 + Math.random() * .7, p: Math.random() * 6.28, r: Math.random() * 6.28, vr: (Math.random() - .5) * 1.4, al: .5 + Math.random() * .35 }; };
  const size = () => { D = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0);
    const n = Math.round(Math.min(18, Math.max(9, W / 60))); while (petals.length < n) petals.push(make(false)); petals.length = n; };
  addEventListener("resize", size); size();
  function petal(p) { x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.max(.25, Math.abs(Math.cos(p.p * .8)))); x.globalAlpha = p.al;
    const g = x.createLinearGradient(0, -p.s, 0, p.s); g.addColorStop(0, p.a); g.addColorStop(1, p.b); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -p.s); x.bezierCurveTo(p.s * .9, -p.s * .6, p.s * .8, p.s * .6, 0, p.s); x.bezierCurveTo(-p.s * .8, p.s * .6, -p.s * .9, -p.s * .6, 0, -p.s); x.fill(); x.restore(); }
  function tick(t) { const dt = Math.min(.05, (t - last) / 1000 || 0); last = t; x.clearRect(0, 0, W, H);
    petals.forEach((p, i) => { p.y += p.vy * dt; p.p += p.f * dt * 3; p.x += Math.sin(p.p) * p.sw * dt; p.r += p.vr * dt;
      if (p.y > H + 24 || p.x < -40 || p.x > W + 40) petals[i] = make(true); else petal(p); });
    requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
})();
