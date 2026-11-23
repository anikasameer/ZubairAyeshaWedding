/* =====================================================================
   Calendar — builds December 2026 and circles the event dates (3, 11, 13) by hand, in pen red.
   Rings are drawn one after another, held, rubbed out in reverse, then redrawn with a new
   hand: a looping, gentle reminder. Every ring has its own shape, speed and pauses (random),
   at roughly half the speed of the reference animation (0.6s per ring → ~1.2s).
   ===================================================================== */
(function () {
  const grid = document.getElementById("calGrid"), ink = document.getElementById("calInk"), board = document.getElementById("calBoard");
  if (!grid) return;
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const YEAR = 2026, MONTH = 11, EVENTS = window.Invite?.days || [3, 11, 13];   // only the dates this guest is invited to   // December (0-based month)
  const DOW = ["M", "T", "W", "T", "F", "S", "S"];
  const DOW_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];   // read out in full by screen readers   // week starts on Monday; the weekend sits at the end

  // ---- Build the month ----
  DOW.forEach((d, i) => {
    const el = document.createElement("div");
    el.className = "cal__dow" + (i >= 5 ? " cal__dow--weekend" : "");
    el.textContent = d; el.setAttribute("aria-label", DOW_FULL[i]); el.setAttribute("role", "columnheader"); grid.appendChild(el);
  });
  // the pencil rule sits under the weekday letters, across the whole week
  const rule = document.createElement("div"); rule.className = "cal__rule cal__rule--pencil"; rule.setAttribute("aria-hidden", "true");
  rule.style.gridColumn = "1 / -1"; grid.appendChild(rule);
  const first = (new Date(YEAR, MONTH, 1).getDay() + 6) % 7,   // Monday = 0
        days = new Date(YEAR, MONTH + 1, 0).getDate();
  const cells = {};
  for (let i = 0; i < first; i++) { const e = document.createElement("div"); e.className = "cal__day cal__day--empty"; grid.appendChild(e); }
  for (let d = 1; d <= days; d++) {
    const dow = (first + d - 1) % 7, el = document.createElement("div");
    el.className = "cal__day" + (dow >= 5 ? " cal__day--weekend" : "") + (EVENTS.includes(d) ? " cal__day--event" : "");
    el.setAttribute("role", "cell");
    const ev = (window.Invite?.events || []).find(e => e.day === d);
    el.innerHTML = ev   // circled dates are buttons: they open that event's details below
      ? `<button class="cal__num cal__num--link" type="button" data-event-code="${ev.code}" aria-label="${d} December, ${ev.en}: show details">${d}</button>`
      : `<span class="cal__num">${d}</span>`;
    grid.appendChild(el); cells[d] = el;
  }

  // ---- A hand-drawn ring: a tilted, wobbly ellipse that runs ~1.14 times round and widens as it goes ----
  const rnd = (a, b) => a + Math.random() * (b - a);
  function ringPath(cx, cy, rx, ry, R = Math.random) {
    const rr = (a, b) => a + R() * (b - a);
    const turns = rr(1.06, 1.22), start = rr(-2.3, -1.3), tilt = rr(-.3, -.06), ph = rr(0, 6.28), wob = rr(.05, .09);
    const N = 72, pts = [];
    for (let i = 0; i <= N * turns; i++) {
      const t = i / N, a = start + t * Math.PI * 2;
      const k = (1 + wob * Math.sin(a * 3 + ph) * .5 + rr(-.012, .012)) * (1 + t * .07);   // shake + slight widening
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    return "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
  }

  // Each ring is a sharpie stroke: a bold main line plus a thinner, offset "bristle" line that drags a little
  // behind it, roughened by an SVG filter so the edges look inked rather than vector-perfect.
  let rings = [], drawn = false, shapes = null;
  // The rings carry the same 18k gold glint as the buttons and dividers, in the light (inverse) gold used on dark grounds
  // so they read on the deep green note: a band three boards wide whose bright
  // centre glides across in the shared 5.5s cycle (eased 75% sweep, then a rest), like the CSS shimmer.
  function goldGradient(w) {
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const base = v("--ring-base"), mid = v("--ring-mid"), hi = v("--ring-hi"), glint = "#FFFFFF", W = 3 * w;
    const stops = [[0, base], [.36, base], [.42, mid], [.47, hi], [.5, glint], [.53, hi], [.58, mid], [.64, base], [1, base]]
      .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
    const anim = reduce ? "" : `<animateTransform attributeName="gradientTransform" type="translate" begin="indefinite" dur="${v("--shimmer-dur") || "5.5s"}" repeatCount="indefinite"
      values="${-3 * w} 0; ${w} 0; ${w} 0" keyTimes="0; .75; 1" calcMode="spline" keySplines=".45 0 .55 1; 0 0 1 1"/>`;
    return `<linearGradient id="ringGold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${W * .36}" gradientTransform="translate(${-3 * w} 0)">${stops}${anim}</linearGradient>`;
  }
  function layoutRings() {
    const w = board.clientWidth, h = board.clientHeight;
    ink.setAttribute("viewBox", `0 0 ${w} ${h}`);
    ink.innerHTML = `<defs><filter id="sharpie" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="1" seed="11" result="h"/>
      <feColorMatrix in="h" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 0 0 0 6.1" result="holes"/>
      <feComposite in="d" in2="holes" operator="in"/></filter>${goldGradient(w)}</defs>`;   // tiny skips where the felt tip lifts off the paper grain
    // one unique hand per ring, kept across resizes (relative to the cell), so a ring never changes once drawn
    shapes = shapes || EVENTS.map(() => ({ seed: Math.random(), rx: rnd(.47, .53), ry: rnd(.5, .58), dx: rnd(-.04, .04), dy: rnd(-.04, .04), w: rnd(2.6, 3.1) }));
    rings = EVENTS.map((d, i) => {
      const c = cells[d], sh = shapes[i];
      const cx = c.offsetLeft + c.offsetWidth * (.5 + sh.dx), cy = c.offsetTop + c.offsetHeight * (.5 + sh.dy);
      const g = document.createElementNS(NS, "g"); g.setAttribute("filter", "url(#sharpie)");
      const r = seeded(sh.seed), d0 = ringPath(cx, cy, c.offsetWidth * sh.rx, c.offsetHeight * sh.ry, r);
      const parts = [["cal__ring", d0, sh.w], ["cal__ring cal__ring--bristle", d0, sh.w * .35]].map(([cls, d, sw], k) => {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("class", cls); p.setAttribute("pathLength", "1"); p.setAttribute("d", d);
        p.style.strokeWidth = sw;
        if (k) p.setAttribute("transform", `translate(${r() * 1.6 - .8} ${r() * 1.6 - .2})`);
        p.style.strokeDasharray = "1 1.1"; p.style.strokeDashoffset = reduce || drawn ? 0 : 1.05;   // the gap is longer than the ring and the dash starts past its end, so an undrawn ring has no rounded cap to show
        if (!(reduce || drawn)) p.style.visibility = "hidden";   // a round cap on an undrawn stroke still paints a dot at its start: keep the pen off the paper until its turn
        g.appendChild(p); return p;
      });
      ink.appendChild(g); return parts;
    });
    glint();   // a resize rebuilds the rings: keep the glint going
  }
  // a small seeded random, so a ring keeps its exact shape when the layout is recalculated
  function glint() { if (drawn) ink.querySelector("animateTransform")?.beginElement?.(); }
  function seeded(x) { let s = Math.floor(x * 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ---- Draw 3 → 11 → 13 once, each at its own pace, then leave them on the page ----
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let running = false;
  async function loop() {
    if (running || drawn) return; running = true;
    for (const [main, bristle] of rings) {
      const dur = rnd(1000, 1700), ease = "cubic-bezier(.45,.05,.4,1)";   // ~0.5x the reference speed, never the same twice
      main.style.visibility = bristle.style.visibility = "";   // pen down: this ring's turn
      bristle.animate([{ strokeDashoffset: 1.05 }, { strokeDashoffset: 0 }], { duration: dur * rnd(1.02, 1.08), easing: ease, fill: "forwards" });
      await main.animate([{ strokeDashoffset: 1.05 }, { strokeDashoffset: 0 }], { duration: dur, easing: ease, fill: "forwards" }).finished.catch(() => {});
      if (!running) return;
      await wait(rnd(250, 750));
    }
    drawn = true; running = false;
    setTimeout(glint, 600);   // the glint starts once the rings are drawn, so it never competes with the stamp, the Urdu name or the pen
  }

  let rq; addEventListener("resize", () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { tear(); layoutRings(); }); });
  // ---- Torn paper: jagged outlines for the paper and its lighter fibre rim (seeded, so it never changes) ----
  const note = document.getElementById("cal");
  function torn(el, amp, seedV) {
    const R = seeded(seedV), pts = [], step = 7;
    const W = note.offsetWidth, H = note.offsetHeight;
    const j = () => (R() * amp).toFixed(1);
    for (let x = 0; x <= W; x += step) pts.push(`${x}px ${j()}px`);                               // top
    for (let y = step; y <= H; y += step) pts.push(`calc(100% - ${j()}px) ${y}px`);              // right
    for (let x = W; x >= 0; x -= step) pts.push(`${x}px calc(100% - ${j()}px)`);                 // bottom
    for (let y = H; y >= step; y -= step) pts.push(`${j()}px ${y}px`);                           // left
    el.style.clipPath = `polygon(${pts.join(",")})`;
  }
  function tear() {
    frame();
    torn(note.querySelector(".cal__paper"), 3.2, .41);
    torn(note.querySelector(".cal__edge"), 4.4, .77);
  }

  // ---- Engraved frame: double hairline + C-scroll flourishes in the corners, sized to the paper ----
  function frame() { drawFrame(document.getElementById("calFrame"), note.offsetWidth, note.offsetHeight); }
  // The same inlaid frame, reused on the invitation card (smaller margin and corners, softer shade on ivory)
  function drawFrame(svg, W, H, { m = 12, c = 30, id = "calEmboss", shade = .6, lit = .22, lip = .14 } = {}) {
    // one corner, drawn for the top-left; the others are mirrored copies
    const corner = `
      <path d="M${m} ${m + c} C${m} ${m + 12} ${m + 12} ${m} ${m + c} ${m}" stroke-width="1.6"/>
      <path d="M${m + c} ${m} C${m + c + 8} ${m - 1} ${m + c + 12} ${m + 4} ${m + c + 8} ${m + 7} C${m + c + 5} ${m + 9} ${m + c + 2} ${m + 6} ${m + c + 4.5} ${m + 4.5}" stroke-width="1.4"/>
      <path d="M${m} ${m + c} C${m - 1} ${m + c + 8} ${m + 4} ${m + c + 12} ${m + 7} ${m + c + 8} C${m + 9} ${m + c + 5} ${m + 6} ${m + c + 2} ${m + 4.5} ${m + c + 4.5}" stroke-width="1.4"/>
      <path d="M${m + 6} ${m + c - 2} C${m + 8} ${m + 14} ${m + 14} ${m + 8} ${m + c - 2} ${m + 6}" stroke-width="1"/>
      <path class="leaf" d="M${m + 7} ${m + 7} Q${m + 17} ${m + 9} ${m + 19} ${m + 19} Q${m + 9} ${m + 17} ${m + 7} ${m + 7}Z"/>
      <circle cx="${m + 4}" cy="${m + 4}" r="1.6" stroke-width="1.2"/>`;
    const flips = [`translate(0 0)`, `translate(${W} 0) scale(-1 1)`, `translate(0 ${H}) scale(1 -1)`, `translate(${W} ${H}) scale(-1 -1)`];
    const g = m + 3;   // inner rule
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    // Blind emboss, matching the rose motif's deboss at this scale: dark shade inside the top-left edges, a lit lip below
    const emboss = `<defs><filter id="${id}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
      <feOffset in="SourceAlpha" dx=".8" dy="1.1" result="a"/><feGaussianBlur in="a" stdDeviation=".35" result="ab"/>
      <feComposite in="SourceAlpha" in2="ab" operator="out" result="topEdge"/>
      <feFlood flood-color="#0b0f06" flood-opacity="${shade}"/><feComposite in2="topEdge" operator="in" result="shade"/>
      <feOffset in="SourceAlpha" dx="-.5" dy="-.7" result="b"/><feGaussianBlur in="b" stdDeviation=".3" result="bb"/>
      <feComposite in="SourceAlpha" in2="bb" operator="out" result="lowEdge"/>
      <feFlood flood-color="#fff" flood-opacity="${lit}"/><feComposite in2="lowEdge" operator="in" result="lit"/>
      <feOffset in="SourceAlpha" dx="0" dy=".9" result="c"/><feComposite in="c" in2="SourceAlpha" operator="out" result="lip"/>
      <feFlood flood-color="#fff" flood-opacity="${lip}"/><feComposite in2="lip" operator="in" result="liplit"/>
      <feMerge><feMergeNode in="liplit"/><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/><feMergeNode in="lit"/></feMerge>
    </filter></defs>`;
    svg.innerHTML = emboss + `<g filter="url(#${id})">` + flips.map(t => `<g transform="${t}">${corner}</g>`).join("") + `
      <line x1="${m + c + 14}" y1="${m}" x2="${W - m - c - 14}" y2="${m}" stroke-width="1.6"/>
      <line x1="${m + c + 14}" y1="${H - m}" x2="${W - m - c - 14}" y2="${H - m}" stroke-width="1.6"/>
      <line x1="${m}" y1="${m + c + 14}" x2="${m}" y2="${H - m - c - 14}" stroke-width="1.6"/>
      <line x1="${W - m}" y1="${m + c + 14}" x2="${W - m}" y2="${H - m - c - 14}" stroke-width="1.6"/>
      <line x1="${g + c}" y1="${g}" x2="${W - g - c}" y2="${g}" stroke-width="1"/>
      <line x1="${g + c}" y1="${H - g}" x2="${W - g - c}" y2="${H - g}" stroke-width="1"/>
      <line x1="${g}" y1="${g + c}" x2="${g}" y2="${H - g - c}" stroke-width="1"/>
      <line x1="${W - g}" y1="${g + c}" x2="${W - g}" y2="${H - g - c}" stroke-width="1"/></g>`;
  }

  // ---- The stamp is pressed on once, with a little thump ----
  const stampEl = document.getElementById("calStamp");
  const INK = .85, R = -14;   // light ink so the divider and event names read over it; a hand-stamped angle
  function stamp(instant) {
    if (instant || reduce) { stampEl.style.opacity = INK; return Promise.resolve(); }
    return stampEl.animate([
      { opacity: 0, scale: "1.35", rotate: `${R - 6}deg` },
      { opacity: INK, scale: ".96", rotate: `${R}deg`, offset: .7 },
      { opacity: INK, scale: "1", rotate: `${R}deg` }],
      { duration: 520, easing: "cubic-bezier(.3,0,.4,1)", fill: "forwards" }).finished.catch(() => {});
  }

  // Started by the page once the note has faded in; rings begin when the note is on screen.
  let io, ioStamp;
  function start(instant) {
    tear(); layoutRings();   // measure again now that fonts and layout have settled
    if (reduce || instant) { stamp(true); if (!reduce) loop(); return; }
    io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(loop, 250); } }, { threshold: .45 });
    io.observe(board);
    // the stamp now lives by the RSVP button: it thumps on when that part of the page scrolls into view
    ioStamp = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { ioStamp.disconnect(); stamp(); } }, { threshold: .6 });
    ioStamp.observe(stampEl);
  }
  function stop() {
    io?.disconnect(); ioStamp?.disconnect(); running = false; drawn = false; shapes = null; stampEl.getAnimations().forEach(a => a.cancel()); stampEl.style.opacity = "";   // replay (prototype): a fresh hand next time
    ink.querySelectorAll("path").forEach(p => p.getAnimations().forEach(a => a.cancel()));
    layoutRings();
  }
  tear(); layoutRings();
  // ---- Tapping a circled date scrolls to that event below ----
  grid.addEventListener("click", e => {
    const b = e.target.closest(".cal__num--link"); if (!b) return;
    e.stopPropagation();
    const item = document.querySelector(`.event[data-event-code="${b.dataset.eventCode}"]`); if (!item) return;   // events are always open: bring this one into view
    item.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  });

  // ---- Add to calendar: one .ics file with the events this guest is invited to ----
  document.getElementById("calAdd")?.addEventListener("click", e => { e.stopPropagation(); window.AddToCalendar ? window.AddToCalendar.open(window.Invite.events) : window.Invite.downloadIcs(window.Invite.events); });

  // the invitation card wears the calendar's inlaid frame too, redrawn whenever the card changes size
  const cardFrame = document.getElementById("cardFrame");
  if (cardFrame) {
    const card = cardFrame.closest(".invite-card");
    const drawCard = () => drawFrame(cardFrame, card.offsetWidth, card.offsetHeight, { m: 9, c: 22, id: "cardEmboss", shade: .3, lit: .9, lip: .7 });
    drawCard(); new ResizeObserver(drawCard).observe(card);
  }
  window.Cal = { start, stop, relayout: layoutRings };
})();
