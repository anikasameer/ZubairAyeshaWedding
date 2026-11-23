/* Postage-stamp edge for each event card: a pencil outline in the event's ink with evenly spaced perforation
   notches (small half-circles biting inward) along every side, redrawn when the card resizes. */
(() => {
  const PITCH = 32, R = 6;   // one notch every ~32px, 6px radius: a loose, airy perforation
  // one side from (x0,y0) to (x1,y1); notches bite towards the inside (inward normal nx, ny)
  function side(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / PITCH)), step = len / n;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    let d = "";
    for (let i = 0; i < n; i++) {
      const c = step * (i + .5);   // notch centre along the side
      const ax = x0 + ux * (c - R), ay = y0 + uy * (c - R), bx = x0 + ux * (c + R), by = y0 + uy * (c + R);
      d += ` L${ax.toFixed(2)} ${ay.toFixed(2)} A${R} ${R} 0 0 0 ${bx.toFixed(2)} ${by.toFixed(2)}`;   // clockwise path, sweep 0 = bite inward
    }
    return d + ` L${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  // pencil grain: a slight wobble, then tiny skips where the graphite misses the paper tooth (like the calendar's rule)
  const pencil = (id, w, h) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="-4" y="-4" width="${w + 8}" height="${h + 8}">
      <feTurbulence type="fractalNoise" baseFrequency=".8 .4" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.2" result="tooth"/>
      <feComposite in="d" in2="tooth" operator="in"/></filter>`;
  // Both are painted as a static picture (an SVG image as the element's background) rather than live SVG: the grain
  // filter then renders once, instead of on every frame while the page fades and scrolls (heavy on iPhone).
  const paint = (el, w, h, body, id) => {
    el.innerHTML = "";
    el.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' overflow='visible'><defs>${pencil(id, w, h)}</defs>${body}</svg>`)}")`;
    el.style.backgroundRepeat = "no-repeat"; el.style.backgroundSize = "100% 100%";
  };
  const ink = el => getComputedStyle(el).color;
  const weight = (el, name, fallback) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || fallback;
  // the ruled line under each title: one slightly uneven hand-drawn stroke
  function rule(svg) {
    const w = svg.clientWidth; if (!w) return;
    paint(svg, w, 6, `<path filter='url(#p)' d='M1 3.2 Q${w * .25} 2.6 ${w * .5} 3 T${w - 1} 2.8' fill='none' stroke='${ink(svg)}' stroke-width='${weight(svg, "--event-rule-weight", 1.4)}' stroke-linecap='round'/>`, "p");
  }
  function draw(card) {
    const svg = card.querySelector(".event__edge"), w = card.offsetWidth, h = card.offsetHeight;
    if (!w || !h) return;
    const m = 4.5, W = w + 8, H = h + 8;   // the picture is 4px bigger on every side, so the pencil's wobble is never clipped
    Object.assign(svg.style, { inset: "-4px", width: W + "px", height: H + "px", maxWidth: "none" });   // (svg elements are capped at 100% wide by the base styles)
    paint(svg, W, H, `<path filter='url(#p)' d='M${m} ${m}${side(m, m, W - m, m)}${side(W - m, m, W - m, H - m)}${side(W - m, H - m, m, H - m)}${side(m, H - m, m, m)} Z' fill='none' stroke='${ink(svg)}' stroke-width='${weight(svg, "--event-edge-weight", 1.75)}' stroke-linecap='round' stroke-linejoin='round'/>`, "p");
  }
  const cards = [...document.querySelectorAll(".event__card")];
  const ro = new ResizeObserver(es => es.forEach(e => draw(e.target)));
  cards.forEach(c => { draw(c); ro.observe(c); });
  const rules = [...document.querySelectorAll(".event__rule")];
  const rro = new ResizeObserver(es => es.forEach(e => rule(e.target)));
  rules.forEach(r => { rule(r); rro.observe(r); });
  // Wide cards (visual · details · Directions on one row): the visual grows to the full height of the details beside it,
  // keeping its 108 × 144 (3:4) proportion, never stretched. Narrower cards keep the CSS size.
  const MAXW = 108;   // the natural size of the artwork; wider would squeeze the details (and the date onto two lines)
  const fit = card => {
    const vis = card.querySelector(".event__visual"), info = card.querySelector(".event__info");
    if (!vis || !info) return;
    const wide = getComputedStyle(card).gridTemplateColumns.split(" ").length >= 3;
    if (!wide) { vis.style.width = vis.style.height = ""; return; }
    // capped at 108px wide: a wider visual would squeeze the details, making them taller, making the visual wider…
    const w = Math.min(MAXW, Math.round(info.offsetHeight * 108 / 144)), h = Math.round(w * 144 / 108);
    if (Math.abs(parseFloat(vis.style.width || 0) - w) > 1) { vis.style.height = h + "px"; vis.style.width = w + "px"; }
  };
  const fro = new ResizeObserver(es => requestAnimationFrame(() => es.forEach(e => fit(e.target.closest(".event__card")))));
  cards.forEach(c => { fit(c); fro.observe(c); fro.observe(c.querySelector(".event__info")); });
  // redraw in a new ink (e.g. when a page switches a card's [data-event])
  window.EventCards = { redraw() { cards.forEach(draw); rules.forEach(rule); cards.forEach(fit); } };
})();
