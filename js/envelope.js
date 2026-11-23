/* First view: envelope → card.
   Triggers: tap/click on envelope or "Open invite", scroll/swipe down, keyboard (Enter, Space, ↓).
   Plain Web Animations API — no animation library to download. */
(() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const stage = $("stage"), env = $("env"), flap = $("flap"), flapWrap = $("flapWrap"),
        seal = $("seal"), rose = $("rose"), card = $("card"), prompt = $("prompt"), cue = $("cue");
  // the rose fades and settles onto the envelope as soon as its image is ready (decoded, so it never paints half-drawn)
  const showRose = () => setTimeout(() => { rose.classList.add("is-in"); setTimeout(() => rose.classList.add("is-settled"), 1500); }, 120);
  if (rose.complete && rose.naturalWidth) (rose.decode ? rose.decode().catch(() => {}) : Promise.resolve()).then(showRose);
  else { rose.addEventListener("load", () => (rose.decode ? rose.decode().catch(() => {}) : Promise.resolve()).then(showRose), { once: true }); rose.addEventListener("error", showRose, { once: true }); }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  if (params.has("embed")) root.classList.add("embed");

  /* ---- Personalised name: ?to=Imran%20and%20family ---- */
  // The guest's name is written in by hand (js/signature.js), a beat after the page appears.
  let nameTimer, curName = "";
  const setName = (n, { wait = 0 } = {}) => {
    curName = n || "";
    const el = $("guestName"); el.hidden = !n; const dear = $("inviteDear"); if (dear) { dear.textContent = n ? "Dear " + n + "," : ""; dear.hidden = !n; } const en = $("envName"); if (en) { en.textContent = n || ""; en.classList.toggle("is-short", (n || "").length <= 14); en.hidden = !n; }
    clearTimeout(nameTimer);
    // lay out with the full name first (hidden), so the prompt sits in its final place, then write it in
    if (n) el.style.visibility = "hidden";
    const promptEl = $("prompt"); promptEl.classList.remove("is-lit");   // the soft shade behind the name and button fades in with the writing
    const btn = $("openBtn"), before = btn.offsetTop;   // its place within the prompt (the prompt itself is positioned by layout)
    window.Signature.writeLines(el, n || "", { size: 34, animate: false }).then(() => {
      layout();
      // when the name takes more (or less) room, the button glides to its new place instead of jumping
      const dy = before - btn.offsetTop;
      if (dy && !reduce) btn.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: 700, easing: "cubic-bezier(.65,0,.35,1)" });
      if (n) nameTimer = setTimeout(() => { el.style.visibility = ""; promptEl.classList.add("is-lit"); window.Signature.writeLines(el, n, { size: 34 }); }, wait);
      else requestAnimationFrame(() => promptEl.classList.add("is-lit"));
    });
  };

  /* ---- Timings (ms) — mirror the motion tokens ---- */
  const T = { seal: 650, flap: 1200, hold: 450, slide: 1250, forward: 1300 };   // slower, overlapping beats; hold = a moment to see the photo lining
  const EASE = { paper: "cubic-bezier(.55,0,.35,1)", out: "cubic-bezier(.22,1,.36,1)", glide: "cubic-bezier(.2,.6,.3,1)", lift: "cubic-bezier(.5,0,.75,1)" };

  let state = "closed", g;

  /* The card keeps one size from start to finish: 90% of the envelope's width (≈86% of its height).
     Inside (sitting low, so the lined interior shows above it; the part below the envelope is clipped)
     → slides fully out above the envelope → drops back down IN FRONT of the pocket. */
  function geometry() {
    const e = env.getBoundingClientRect();
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const s = (e.width * .9) / cw, h = ch * s, H = e.height;
    const y0 = e.top + H * .3;
    return {
      e, s,
      x: e.left + (e.width - cw * s) / 2,
      y0,
      c0: Math.max(0, (y0 + h - (e.bottom - H * .02)) / s),   // local px hidden below the envelope while inside
      y1: e.top - h - H * .03,                                 // slid fully out, just clear of the envelope
      yF: e.top - H * .23,                                     // resting in front, overlapping the envelope
    };
  }
  // Clip only the bottom (the part still below the envelope). The other sides get room so the card's shadow isn't cut off.
  const clip = b => `inset(-80px -80px ${b > 0 ? b : -80}px -80px)`;
  // Card transform: position + scale (origin top-left), plus a tilt around the card's own centre.
  const TILT = -2;   // degrees: the card rests at a slight angle
  const tf = (x, y, s, r = 0) => {
    const cx = card.offsetWidth / 2, cy = card.offsetHeight / 2;
    return `translate(${x}px, ${y}px) scale(${s}) translate(${cx}px, ${cy}px) rotate(${r}deg) translate(${-cx}px, ${-cy}px)`;
  };

  function layout() {
    g = geometry();
    prompt.style.top = `${g.e.bottom + Math.min(28, innerHeight * .03)}px`;
    if (state === "closed") { card.style.transform = tf(g.x, g.y0, g.s); card.style.clipPath = clip(g.c0); }
    if (state === "open")   { card.style.transform = tf(g.x, g.yF, g.s, TILT); card.style.clipPath = clip(0); }
    card.style.visibility = "visible";
  }

  /* Run an animation, keep its end state as inline style, release the animation. */
  function run(el, frames, opts) {
    const a = el.animate(frames, { fill: "forwards", ...opts });
    return a.finished.then(() => {
      // keep the end state; if the browser can't commit it (some mobile webviews), write the last keyframe by hand
      try { a.commitStyles(); } catch (_) { const last = frames[frames.length - 1]; for (const k in last) if (k !== "offset" && k !== "easing") el.style[k] = last[k]; }
      a.cancel();
    }).catch(() => {});
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function open() {
    if (state !== "closed") return;
    state = "opening"; stage.classList.add("is-open");
    rose.classList.add("is-in", "is-settled");   // drop the load-in fade, so the rose leaves exactly with the seal
    g = geometry();
    run(prompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: "ease-out" });

    if (reduce) {
      [seal, rose, flapWrap].forEach(el => el.style.opacity = 0);
      card.classList.add("is-forward");
      card.style.transform = tf(g.x, g.yF, g.s, TILT); card.style.clipPath = clip(0);
      await run(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      return done();
    }

    // 1 · the seal pops
    run(seal, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.1)", opacity: 1, offset: .4 }, { transform: "scale(.4)", opacity: 0 }],
        { duration: T.seal, easing: EASE.paper });
    run(rose, [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(10px)" }], { duration: T.seal, easing: "ease-out" });   // the rose slips away as the seal breaks
    await wait(T.seal * .55);   // the flap starts lifting while the seal is still fading

    // 2 · the flap opens; its back (the liner) shows past 90°, and it drops behind the card
    const liner = "linear-gradient(180deg, #EFE9DE, #E9E2D6)", front = getComputedStyle(flap).backgroundImage;
    setTimeout(() => { flapWrap.style.zIndex = 1; flap.classList.add("is-lined"); }, T.flap * .5);
    await run(flap, [
      { transform: "perspective(900px) rotateX(0deg)", backgroundImage: front },
      { transform: "perspective(900px) rotateX(90deg)", backgroundImage: front, offset: .5 },
      { transform: "perspective(900px) rotateX(90deg)", backgroundImage: liner, offset: .501 },
      { transform: "perspective(900px) rotateX(180deg)", backgroundImage: liner }],
      { duration: T.flap, easing: EASE.paper });

    await wait(T.hold);

    // 3+4 · one continuous move: up and fully out of the pocket, then — without stopping —
    //       it drops back down in front of the envelope and settles. No zoom, the envelope stays put.
    const total = T.slide + T.forward, split = T.slide / total;
    setTimeout(() => card.classList.add("is-forward"), T.slide);
    setTimeout(writeNames, T.slide * .55);   // the pen starts as the card clears the envelope
    await run(card, [
      { transform: tf(g.x, g.y0, g.s), clipPath: clip(g.c0), easing: EASE.lift },             // leaves the pocket, gathering speed
      { transform: tf(g.x, g.y1, g.s), clipPath: clip(0), offset: split, easing: EASE.glide },  // clears the envelope and turns
      { transform: tf(g.x, g.yF, g.s, TILT), clipPath: clip(0) }],                             // …settling at a slight angle                                   // eases gently down to rest, no bounce
      { duration: total });
    done();
  }

  let openedAt = 0;
  function done() {
    state = "open"; openedAt = performance.now(); root.classList.add("is-open");
    card.style.willChange = "auto";   // let the browser re-render text crisply at the final scale
    run(cue, [{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 500, delay: 200, easing: EASE.out });
    
  }

  /* =================== Stage 2: the card opens out into the page =================== */
  const sheet = $("sheet"), page = $("page"), rsvpBtn = $("rsvpWrap"), calNote = $("cal"), eventsSec = $("events"), urdu = $("urdu"), sheetRule = $("sheetRule"), sheetDivider = $("sheetDivider"), sheetDividerEnd = $("sheetDividerEnd");
  const T2 = { expand: 1300, details: 320, urdu: 1200 };
  const EASE2 = "cubic-bezier(.65,0,.35,1)";   // smooth ease in-out
  let pageState = "none";
  const insetOf = (r, rad = 0) => `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${rad}px)`;
  const pairs = () => {
    const c = card.querySelectorAll(".invite-card__line, .invite-card__names");
    const p = page.querySelectorAll(".page__line, .page__names");
    return [...c].map((el, i) => [el, p[i]]);
  };

  // Wrap every word in a span (no visual change) so the card → page move can be animated word by word.
  function wrapWords(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const f = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) f.append(part);
        else { const w = document.createElement("span"); w.className = "w"; w.textContent = part; f.append(w); }
      });
      n.replaceWith(f);
    });
  }
  card.querySelectorAll(".invite-card__line, .invite-card__names").forEach(wrapWords);
  page.querySelectorAll(".page__line, .page__names").forEach(wrapWords);
  // the couple's names shimmer in gold on the card and the page (each name word; "with" stays plain); Ayesha a beat after Zubair
  document.querySelectorAll(".invite-card__names > .w, .page__names > .w").forEach((w, i) => {
    w.classList.add("shimmer-text"); w.style.animationDelay = (i % 2) * .25 + "s";
  });
  // The couple's names on the card are handwritten in as the card comes out of the envelope: Zubair, then Ayesha.
  const nameWords = [...card.querySelectorAll(".invite-card__names > .w")];
  const setNames = p => nameWords.forEach(w => w.style.setProperty("--sig-p", p));
  setNames(reduce ? "100%" : "0%");
  let nameRun = 0;
  async function writeNames() {
    const run = ++nameRun;
    if (window.Signature) await window.Signature.ready(30);   // write only once the handwriting font is in
    for (const w of nameWords) {
      if (run !== nameRun) return;   // replayed mid-way
      if (window.Signature?.reveal) await window.Signature.reveal(w, { duration: window.Signature.durationFor(w.textContent) });
      if (run !== nameRun) return;
      w.style.setProperty("--sig-p", "100%");
      await wait(140);
    }
  }

  const pen = [...urdu.querySelectorAll(".page__urdu-pen path")], urduFull = urdu.querySelector(".page__urdu-full");
  let penAnims = [];
  // The Urdu name isn't written any more: the ink simply soaks into the paper — it starts soft and
  // blurred, as if just touching the fibres, and settles crisp. Quiet, so it never competes with the rest.
  async function writeUrdu(instant = false) {
    urduFull.style.opacity = 1;
    if (instant) { urdu.style.opacity = 1; return; }
    urdu.style.willChange = "opacity, filter, transform";   // its own layer for the soak-in, so it plays smoothly on iPhone
    const a = urdu.animate([
      { opacity: 0, filter: "blur(8px)", scale: "1.015" },
      { opacity: .55, filter: "blur(3px)", offset: .45 },
      { opacity: 1, filter: "blur(0px)", scale: "1" }],
      { duration: 2600, easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" });
    penAnims = [a];
    await a.finished.catch(() => {});
    if (penAnims[0] === a) { a.commitStyles?.(); a.cancel(); urdu.style.filter = ""; urdu.style.willChange = ""; }
  }


  async function openPage(instant = false) {
    if (state !== "open" || pageState !== "none") return;
    if (!instant && performance.now() - openedAt < 700) return;   // ignore the tail of the scroll that opened the envelope
    pageState = "opening"; root.classList.add("is-paging");
    window.LeafShadows?.prepare();   // draw the plants now, so they are ready (invisible) long before they fade in
    // Card geometry without the tilt: centre, size, and its four (tilted) corners on screen.
    const bb = card.getBoundingClientRect(), S = g?.s || 1;
    const C = { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }, W = card.offsetWidth * S, H = card.offsetHeight * S;
    const a = TILT * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const pt = (lx, ly) => `${C.x + lx * cos - ly * sin}px ${C.y + lx * sin + ly * cos}px`;
    const from = `polygon(${pt(-W/2, -H/2)}, ${pt(W/2, -H/2)}, ${pt(W/2, H/2)}, ${pt(-W/2, H/2)})`;
    const to = `polygon(0px 0px, ${innerWidth}px 0px, ${innerWidth}px ${innerHeight}px, 0px ${innerHeight}px)`;
    const L = C.x - W / 2, Tp = C.y - H / 2;   // untilted top-left of the card

    // The sheet starts exactly as the card (same tilt), wearing its gold rule and leaf divider…
    const place = (el, lx, ly, w, h) => Object.assign(el.style, {
      left: L + lx + "px", top: Tp + ly + "px", width: w + "px", height: h + "px", opacity: "",
      transform: `rotate(${TILT}deg)`, transformOrigin: `${C.x - (L + lx)}px ${C.y - (Tp + ly)}px` });
    const ruleEl = card.querySelector(".invite-card__rule");
    sheetRule.innerHTML = ruleEl.innerHTML.replace(/id="[^"]*"/g, "");   // copy of the inlaid frame (the filter it points at stays in the card)
    place(sheetRule, ruleEl.offsetLeft * S, ruleEl.offsetTop * S, ruleEl.offsetWidth * S, ruleEl.offsetHeight * S);
    const de = card.querySelector(".invite-card__divider--end");   // the card's divider (below its text) travels up to become the page's top divider
    sheet.style.clipPath = from;
    sheet.classList.add("is-on");

    // …and every word of the page text starts exactly on top of the same word on the card (tilt and size included),
    // then flows to its place on the page: the type grows and re-wraps word by word, so nothing jumps.
    page.hidden = false;
    const cw = [...card.querySelectorAll(".invite-card__line .w, .invite-card__names .w")];
    const pw = [...page.querySelectorAll(".page__line .w, .page__names .w")];
    const measured = pw.map((el, i) => {
      const c = cw[i]; if (!c) return null;
      const ar = c.getBoundingClientRect(), br = el.getBoundingClientRect();
      const k = (c.offsetWidth * S) / el.offsetWidth;
      return [el, `translate(${(ar.left + ar.width / 2) - (br.left + br.width / 2)}px, ${(ar.top + ar.height / 2) - (br.top + br.height / 2)}px) rotate(${TILT}deg) scale(${k})`];
    }).filter(Boolean);
    // the ornament divider travels too: from the card's divider (below the card text) up to its place above the page text.
    // It keeps the star's size ratio and starts cropped to the card divider's short width, then its rules draw out to full width.
    const po = page.querySelector(".page__ornament");
    const dr = de.getBoundingClientRect(), orr = po.getBoundingClientRect();
    const ks = (12 * S) / parseFloat(getComputedStyle(po).fontSize);          // star size on the card ÷ on the page
    const crop = Math.max(0, (po.offsetWidth - (de.offsetWidth * S) / ks) / 2 / po.offsetWidth * 100);
    const poFrom = { transform: `translate(${(dr.left + dr.width / 2) - (orr.left + orr.width / 2)}px, ${(dr.top + dr.height / 2) - (orr.top + orr.height / 2)}px) rotate(${TILT}deg) scale(${ks})`, clipPath: `inset(-50% ${crop}% -50% ${crop}%)` };
    Object.assign(po.style, poFrom);
    const flips = measured.map(([el, t]) => { el.style.transform = t; return [el, t]; });
    card.style.visibility = "hidden";
    run(cue, [{ opacity: getComputedStyle(cue).opacity }, { opacity: 0 }], { duration: 250 });

    if (reduce || instant) {
      sheet.style.clipPath = "none"; sheetRule.style.opacity = 0; sheetDivider.style.opacity = 0; sheetDividerEnd.style.opacity = 0;
      flips.forEach(([el]) => el.style.transform = "none"); po.style.transform = "none"; po.style.clipPath = "none";
      rsvpBtn.style.opacity = 1; calNote.style.opacity = 1; eventsSec.style.opacity = 1; window.LeafShadows?.show();
      // even when jumping straight to the page, the Urdu name still soaks in and the stamp still thumps on (both are quick)
      if (reduce) { urdu.style.opacity = 1; window.Cal?.start(true); writeUrdu(true); } else { window.Cal?.start(); writeUrdu(); }
      pageState = "open"; root.classList.add("is-page", "is-scrollable"); return;
    }

    // The paper grows from all sides to fill the screen; card details fade; text eases up to the top.
    run(sheetRule, [{ opacity: .9 }, { opacity: 0 }], { duration: T2.details, easing: "ease-out" });
    run(po, [poFrom, { transform: "translate(0px, 0px) rotate(0deg) scale(1)", clipPath: "inset(-50% 0% -50% 0%)" }], { duration: T2.expand, easing: EASE2 });
    flips.forEach(([el, t]) => run(el, [{ transform: t }, { transform: "translate(0px, 0px) rotate(0deg) scale(1)" }], { duration: T2.expand, easing: EASE2 }));
    // RSVP fades in gently (ease-in-out) as the text settles, rather than popping in at the end.
    run(rsvpBtn, [{ opacity: 0, translate: "0 -4px" }, { opacity: 1, translate: "0 0" }], { duration: 900, delay: T2.expand - 400, easing: "cubic-bezier(.45,0,.55,1)" });
    // the taped calendar note fades in the same gentle way, a beat later
    run(calNote, [{ opacity: 0, translate: "0 -4px" }, { opacity: 1, translate: "0 0" }], { duration: 900, delay: T2.expand - 200, easing: "cubic-bezier(.45,0,.55,1)" })
      .then(() => pageState !== "none" && window.Cal?.start());
    // the event list fades in exactly like the calendar note, at the same moment. While it fades, its gold shimmers and
    // glass blur are held still: on iPhone (WebKit) those layers ignore a fading parent and would pop in at full strength.
    eventsSec.classList.add("is-fading");
    run(eventsSec, [{ opacity: 0, translate: "0 -4px" }, { opacity: 1, translate: "0 0" }], { duration: 900, delay: T2.expand - 200, easing: "cubic-bezier(.45,0,.55,1)" })
      .then(() => eventsSec.classList.remove("is-fading"));
    await run(sheet, [{ clipPath: from }, { clipPath: to }], { duration: T2.expand, easing: EASE2 });
    if (pageState !== "opening") return;
    sheet.style.clipPath = "none";   // full-screen paper from here on (stays correct if the window is resized)
    root.classList.add("is-scrollable");   // the page can be scrolled right away, while the Urdu name settles

    // Card background is now static: the Urdu name is written in, right to left, like a pen on paper.
    await writeUrdu();
    if (pageState !== "opening") return;   // reset mid-way
    window.LeafShadows?.show();   // only once the Urdu name is fully written: a very slow, quiet fade
    pageState = "open"; root.classList.add("is-page");
  }

  function resetPage() {
    penAnims.forEach(a => a.cancel()); penAnims = []; root.classList.remove("is-paging", "is-scrollable"); window.LeafShadows?.hide();
    pen.forEach(p => p.removeAttribute("style")); urduFull.removeAttribute("style");
    window.Cal?.stop(); page.scrollTop = 0;
    eventsSec.classList.remove("is-fading");
    [sheet, sheetRule, sheetDivider, sheetDividerEnd, urdu, rsvpBtn, calNote, eventsSec, ...page.querySelectorAll(".page__line, .page__names, .page .w, .page__ornament")].forEach(el => el.removeAttribute("style"));
    sheet.classList.remove("is-on"); sheetRule.innerHTML = ""; sheetDivider.innerHTML = ""; sheetDividerEnd.innerHTML = ""; page.hidden = true;
    root.classList.remove("is-page"); pageState = "none";
  }

  /* One "next" action for every trigger: closed → open the envelope; open → open out into the page */
  const advance = () => { if (state === "closed") open(); else if (state === "open") openPage(); };

  function reset() {
    if (curName) setName(curName, { wait: 500 });   // write the name in again on replay
    resetPage();
    document.getAnimations().forEach(a => { if (!(window.CSSAnimation && a instanceof CSSAnimation) && a.effect?.target?.closest?.("#stage")) a.cancel(); });   // keep CSS loops (shimmer) alive
    [seal, rose, flap, flapWrap, card, env, prompt, cue].forEach(el => el.removeAttribute("style"));
    card.classList.remove("is-forward"); flap.classList.remove("is-lined"); stage.classList.remove("is-open"); root.classList.remove("is-open");
    nameRun++; nameWords.forEach(w => window.Signature?.stop(w)); setNames(reduce ? "100%" : "0%");
    state = "closed"; layout();
  }

  /* ---- Triggers ---- */
  env.addEventListener("click", advance);
  card.addEventListener("click", advance);
  cue.addEventListener("click", e => { e.stopPropagation(); if (state === "open") { openedAt = 0; openPage(); } });   // the arrow opens the page straight away
  $("openBtn").addEventListener("click", advance);
  // Keyboard: Enter / ↓ / Page Down open it. Space is not a global trigger, and keys typed into a field never are.
  addEventListener("keydown", e => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (["Enter", "ArrowDown", "PageDown"].includes(e.key) && pageState === "none") { e.preventDefault(); advance(); }
  });
  addEventListener("wheel", e => { if (e.deltaY > 2) advance(); }, { passive: true });
  let ty = null;
  addEventListener("touchstart", e => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => { if (ty !== null && ty - e.touches[0].clientY > 18) { ty = null; advance(); } }, { passive: true });

  let rq; addEventListener("resize", () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => state !== "opening" && layout()); });

  /* ---- Prototype hooks: name field, replay, and commands from the device preview ---- */
  const nameInput = $("protoName");
  nameInput?.addEventListener("input", () => setName(nameInput.value.trim(), { wait: 600 }));   // write once typing pauses
  $("protoReplay")?.addEventListener("click", reset);
  // "Open envelope again" at the end of the page: back to the sealed envelope, ready to open once more
  $("replayBtn")?.addEventListener("click", e => { e.stopPropagation(); $("page").scrollTop = 0; reset(); });
  $("protoJump")?.addEventListener("click", e => { e.stopPropagation(); messageFinal(); requestAnimationFrame(() => openPage(true)); });   // prototype: skip straight to the opened page view
  // [R] restarts the animation (ignored while typing in a field)
  addEventListener("keydown", e => {
    if ((e.key === "r" || e.key === "R") && !root.classList.contains("live") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest?.("input, textarea")) reset();
  });
  function messageFinal() {reset(); state = "opening"; stage.classList.add("is-open"); prompt.style.opacity = 0; seal.style.opacity = 0; rose.style.opacity = 0; flapWrap.style.zIndex = 1;
      flap.classList.add("is-lined"); flap.style.transform = "perspective(900px) rotateX(180deg)"; flap.style.backgroundImage = "linear-gradient(180deg, #EFE9DE, #E9E2D6)";
      card.classList.add("is-forward"); state = "open"; layout(); root.classList.add("is-open"); cue.style.opacity = 1;  openedAt = 0; setNames("100%"); }
  addEventListener("message", e => {
    const d = e.data || {};
    if (d.cmd === "open") advance();
    if (d.cmd === "page") { messageFinal(); requestAnimationFrame(() => openPage(true)); }
    if (d.cmd === "playpage") { messageFinal(); setTimeout(() => { openedAt = 0; openPage(); }, 300); }
    if (d.cmd === "reset") reset();
    if (d.cmd === "name") setName(d.value, { wait: 300 });
    if (d.cmd === "final") messageFinal();
  });

  /* ---- Boot: wait for the display font so the card is measured at its real size ---- */
  setName(params.get("to"), { wait: 700 });
  (document.fonts?.ready || Promise.resolve()).then(layout);
  layout();
})();
