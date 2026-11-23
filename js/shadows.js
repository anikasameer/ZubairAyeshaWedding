/* =====================================================================
   Leaf shadows — soft shadows of small-leaved branches falling across the page,
   swaying in a light breeze, with a warm patch of sunlight drifting over the paper.
   Everything is generated here (no image files): each branch is drawn once as a
   blurred bitmap, then only moved with GPU transforms, so it loops cheaply forever.
   The layer sits above everything (fixed, top z-index) and never blocks taps.
   Start/stop: LeafShadows.show() / LeafShadows.hide()
   ===================================================================== */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INK = "#2A221D";   // ink-900: shadows are a deep warm brown, never grey

  // Seeded random, so the branches look the same on every visit
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const r = (a, b) => a + (b - a) * rnd();

  // One small pointed leaf, as an SVG path centred on its stalk, pointing along +x
  const leaf = (len, wid) => `M0 0 C${len * .25} ${-wid} ${len * .7} ${-wid * .9} ${len} 0 C${len * .7} ${wid * .9} ${len * .25} ${wid} 0 0Z`;

  // A branch: a gently curving stem with alternating leaves and a couple of side twigs
  function branch(len, angle, depth, out, k = Math.min(len / 380, 1.1)) {
    const pts = []; let x = 0, y = 0, a = angle;
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      pts.push([x, y]);
      a += r(-.09, .09); x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps;
    }
    out.push(`<path d="M${pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L")}" fill="none" stroke="${INK}" stroke-width="${((depth ? 2 : 3.2) * k).toFixed(1)}" stroke-linecap="round"/>`);
    pts.forEach(([px, py], i) => {
      if (i < 2) return;
      [1, -1].forEach(side => {   // a leaf on each side, slightly staggered — a full, airy spray like the references
        if (rnd() < .2) return;
        const size = r(.75, 1.2) * (depth ? 20 : 25) * k * (1 - i / steps * .3);
        const la = a * 57.3 + side * r(30, 65);
        out.push(`<path d="${leaf(size * 1.7, size * .62)}" transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${la.toFixed(1)})" fill="${INK}"/>`);
      });
      const side = i % 2 ? 1 : -1;
      if (!depth && i % 5 === 2) {   // side twig with its own leaves
        out.push(`<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})">`);
        branch(len * r(.3, .45), a + side * r(.5, .9), 1, out, k);
        out.push("</g>");
      }
    });
    return pts[pts.length - 1];
  }

  // Draw a branch once, blurred, into a canvas
  // A feathery palm frond: an arching midrib with long, slender leaflets on both sides,
  // longest in the middle and tapering to the tip — readable as "palm" even when soft.
  function palm(len, angle, out) {
    const n = 46, bend = r(.35, .5);   // leaflets per side; how much the frond arches down
    let x = 0, y = 0, a = angle; const spine = [[0, 0]];
    for (let i = 1; i <= n; i++) {
      a += bend / n * (Math.cos(angle) >= 0 ? 1 : -1);   // arch toward the ground on either side
      x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; spine.push([x, y, a]);
    }
    out.push(`<path d="M${spine.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")}" fill="none" stroke="${INK}" stroke-width="${(len * .009).toFixed(1)}" stroke-linecap="round"/>`);
    spine.forEach(([px, py, pa], i) => {
      if (i < 4) return;
      const t = i / n, ll = len * .36 * Math.pow(Math.sin(Math.PI * (t * .82 + .08)), .8) * r(.88, 1.08);   // longest mid-frond, tapering smoothly to the tip
      [1, -1].forEach(side => {
        const la = pa + side * (r(.6, .8) - t * .38);   // leaflets sweep forward, closer to the spine near the tip
        const droop = side * len * .03;                   // a gentle curve, like real pinnae
        const ex = px + Math.cos(la) * ll, ey = py + Math.sin(la) * ll;
        const mx = px + Math.cos(la) * ll * .5 - Math.sin(la) * droop, my = py + Math.sin(la) * ll * .5 + Math.cos(la) * droop;
        const w = len * .011;
        out.push(`<path d="M${px.toFixed(1)} ${py.toFixed(1)} Q${(mx - Math.sin(la) * w).toFixed(1)} ${(my + Math.cos(la) * w).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} Q${(mx + Math.sin(la) * w).toFixed(1)} ${(my - Math.cos(la) * w).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}Z" fill="${INK}"/>`);
      });
    });
  }

  // Draw a plant once, blurred, into a canvas. The blur is an SVG filter whose region covers the
  // whole drawing, so it is never clipped (and works in every browser, unlike canvas filters).
  function render(kind, len, angle, blur) {
    const parts = []; kind === "palm" ? palm(len, angle, parts) : branch(len, angle, 0, parts);
    const size = len * 2.8;   // centred on the stem's base, with room for leaves and blur in every direction
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}">` +
      `<filter id="b" filterUnits="userSpaceOnUse" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"><feGaussianBlur stdDeviation="${blur}"/></filter>` +
      `<g filter="url(#b)">${parts.join("")}</g></svg>`;
    const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const c = document.createElement("canvas"), q = .5;   // half resolution is plenty for a soft shadow, and keeps memory low
    c.width = c.height = Math.round(size * q);
    c.style.width = c.style.height = size + "px";
    c.style.left = c.style.top = -size / 2 + "px";
    img.onload = () => c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  let root, light, built = false, anims = [];
  function build() {
    if (built) return; built = true;
    root = document.createElement("div");
    root.className = "leaf-shadows"; root.setAttribute("aria-hidden", "true");
    light = document.createElement("div"); light.className = "leaf-light"; light.setAttribute("aria-hidden", "true");
    const glow = document.createElement("div"); glow.className = "leaf-light__glow"; light.appendChild(glow);
    const W = innerWidth, H = innerHeight, M = Math.max(W, H);
    // [kind, anchor x, anchor y (fraction of viewport), length, angle (rad), blur px, sway deg, period s]
    const layout = [
      ["palm", -.06, -.06, M * .6, .5, 3.5, 1],     // top-left palm frond, arching in and down
      ["leaf", 1.05, .2, M * .42, 2.75, 9, .545],   // top-right, small leaves, lower and fainter (75% of before)
      ["palm", 1.07, .75, M * .52, 3.6, 4.5, .627]   // right palm frond at 3/4 height, reaching up and in — balances the top-left
    ];
    layout.forEach(([kind, ax, ay, len, ang, blur, op], i) => {
      seed = 11 + i * 97;
      const pivot = document.createElement("div"); pivot.className = "leaf-shadows__branch" + (i === 2 ? " leaf-shadows__branch--lower" : "");
      pivot.style.left = ax * 100 + "%"; pivot.style.top = ay * 100 + "%";
      pivot.style.opacity = op;
      const gust = document.createElement("div"); gust.className = "leaf-shadows__gust";
      const flex = document.createElement("div"); flex.className = "leaf-shadows__gust";
      flex.appendChild(render(kind, len, ang, blur)); gust.appendChild(flex); pivot.appendChild(gust); root.appendChild(pivot);
      if (reduce) return;
      // Wind: three layers per plant, each with its own amplitude, period and phase (uneven periods, so no two
      // plants — and no two cycles — ever line up):
      //  1. a slow sway of the whole plant from its base
      //  2. irregular gusts: a push, a partial release, a second smaller push
      //  3. a light flex, so the tip moves more than the stem (the leaflets seem to ripple)
      const amp = r(1.4, 2.6) * (kind === "palm" ? 1 : 1.3), dir = rnd() < .5 ? 1 : -1;
      anims.push(pivot.animate([{ rotate: `${-amp * dir}deg` }, { rotate: `${amp * dir}deg` }],
        { duration: r(9000, 13500), iterations: Infinity, direction: "alternate", easing: "cubic-bezier(.45,0,.55,1)", delay: -r(0, 9000) }));
      const g = r(.9, 1.6) * dir;
      anims.push(gust.animate([
        { rotate: "0deg", translate: "0 0" },
        { rotate: `${g}deg`, translate: `${r(2, 5)}px ${r(-2, 2)}px`, offset: r(.25, .35) },
        { rotate: `${g * .35}deg`, translate: `${r(0, 2)}px 0px`, offset: r(.45, .55) },
        { rotate: `${g * .7}deg`, translate: `${r(1, 4)}px ${r(-2, 2)}px`, offset: r(.65, .75) },
        { rotate: "0deg", translate: "0 0" }],
        { duration: r(4200, 6800), iterations: Infinity, easing: "ease-in-out", delay: -r(0, 6000) }));
      const f = r(.8, 1.6);
      anims.push(flex.animate([{ transform: "skew(0deg, 0deg) scale(1)" }, { transform: `skew(${f * dir}deg, ${-f * .5 * dir}deg) scale(${r(.99, 1.01)})` }],
        { duration: r(2600, 3900), iterations: Infinity, direction: "alternate", easing: "ease-in-out", delay: -r(0, 3000) }));
    });
    if (!reduce) anims.push(glow.animate([{ transform: "translate(-4%, -3%) scale(1)", opacity: .85 }, { transform: "translate(5%, 4%) scale(1.08)", opacity: 1 }],
      { duration: 24000, iterations: Infinity, direction: "alternate", easing: "ease-in-out" }));
    document.body.append(root, light);
  }

  // Appear so slowly the visitor never notices the moment it arrives: a 12s fade that barely moves at first.
  let fades = [];
  const STRENGTH = { shadows: .1016, light: .14 };   // shadows +10% for the top palm; the other two plants are scaled back so they stay as they were   // final opacity: soft, the paper always reads through
  function fade(k, dur, easing) {
    fades.forEach(f => f.cancel());
    fades = [[root, STRENGTH.shadows], [light, STRENGTH.light]].map(([el, max]) =>
      el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: max * k }], { duration: dur, easing, fill: "forwards" }));
  }
  function show() {
    build(); anims.forEach(a => a.play());
    fade(1, 12000, "cubic-bezier(.55,0,.45,1)");
  }
  function hide() {
    if (!root) return; fade(0, 400, "ease-out");
    setTimeout(() => anims.forEach(a => a.pause()), 500);
  }
  window.LeafShadows = { show, hide, prepare: () => build() };   // prepare early so the branches are drawn before they're needed
})();
