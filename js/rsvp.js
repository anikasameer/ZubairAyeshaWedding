/* RSVP: a form for the events this guest is invited to; answers can be changed later from the same link.
   Storage: always on this device (localStorage); also sent to a Google Sheet when <meta name="rsvp-endpoint"> holds the
   Apps Script web-app URL (see rsvp-apps-script.gs). On opening, the saved answer is loaded and the fields are filled in. */
(() => {
  const $ = id => document.getElementById(id);
  const inv = window.Invite, root = $("rsvp"), form = $("rsvpForm"), done = $("rsvpDone"), btn = $("rsvpBtn");
  if (!inv || !root || !btn) return;
  const ENDPOINT = ((window.INVITE_CONFIG && window.INVITE_CONFIG.rsvpEndpoint) || document.querySelector('meta[name="rsvp-endpoint"]')?.content || "").trim();
  const KEY = "za-rsvp:" + (inv.id || "guest");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- storage ---------- */
  const local = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } },
    set(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (_) {} } };
  async function load() {
    let r = local.get();
    if (ENDPOINT && inv.id) {
      try {
        const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(inv.id)}`, { cache: "no-store" });
        const j = await res.json();
        if (j && j.rsvp && (!r || (j.rsvp.updatedAt || "") >= (r.updatedAt || ""))) { r = j.rsvp; local.set(r); }
      } catch (_) { /* offline or not set up: keep the copy on this device */ }
    }
    return r;
  }
  async function save(r) {
    local.set(r);
    if (!ENDPOINT) return true;
    // text/plain keeps this a "simple" request, so Apps Script accepts it without a CORS preflight
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(r) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) throw new Error(j.error || "Could not send");
    return true;
  }

  /* ---------- build the form for this guest ---------- */
  const evBox = $("rsvpEvents");
  // each event's RSVP closes 1 hour before it starts (Gulf time); after that its answer is kept but can't be changed
  const startsAt = e => { const t = e.ics[1]; return new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:00+04:00`); };
  const isClosed = e => Date.now() > startsAt(e).getTime() - 3600e3;
  inv.events.forEach(e => {
    const closed = isClosed(e);
    const row = document.createElement("label");
    row.className = "check-row" + (closed ? " is-disabled" : "");
    row.innerHTML = `<input type="checkbox" name="events" value="${e.n}"${closed ? " disabled" : ""}>
      <span class="check" aria-hidden="true"><span class="icon">check</span></span>
      <span class="check-row__text"><span class="t-body-1 check-row__title">${e.en}</span><span class="t-caption check-row__hint">${closed ? "RSVP closed" : e.when}</span></span>`;
    evBox.append(row);
  });
  if (inv.events.every(isClosed)) btn.hidden = true;   // nothing left to answer
  // the guest's name: from the link, or as typed in the envelope view's name field (prototype)
  let name = inv.name;
  // handwrite the name, wrapping whole words onto the next line when it doesn't fit the width
  const SIG = { size: 30, weight: 1.6 };
  function writeName() {
    name = inv.name || ($("protoName")?.value || "").trim();
    const el = $("rsvpName"); el.hidden = !name; el.setAttribute("aria-label", name);
    if (name && window.Signature) window.Signature.writeLines(el, name, { ...SIG, animate: !reduce });
    else el.textContent = name;
    $("rsvpNameField").hidden = false;   // always shown, pre-filled with the name on the invite; the guest can correct it
  }

  const steppers = [...root.querySelectorAll(".stepper")];
  const val = field => +root.querySelector(`.stepper[data-field="${field}"] .stepper__value`).value;
  function setStep(st, v) {
    const min = +st.dataset.min, max = +st.dataset.max; v = Math.max(min, Math.min(max, v));
    const out = st.querySelector(".stepper__value"); out.value = out.textContent = v;
    st.querySelector('[data-step="-1"]').disabled = v <= min; st.querySelector('[data-step="1"]').disabled = v >= max;
  }
  steppers.forEach(st => { setStep(st, +st.querySelector(".stepper__value").textContent);
    st.addEventListener("click", e => { const b = e.target.closest("[data-step]"); if (b) setStep(st, val(st.dataset.field) + +b.dataset.step); }); });

  // Accept / Decline: the first choice. Declining hides the events and counts and sends regrets.
  const answer = $("rsvpAnswer");
  const accepting = () => answer.dataset.value === "yes";
  function setAnswer(v) {
    answer.dataset.value = v;
    answer.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-checked", b.dataset.v === v));
    sync();
  }
  // Phones: the bottom sheet hugs its content, so switching Accept/Decline changes its height. Ease the sheet to its new
  // height (and fade in what appears) instead of letting it jump.
  const sheet = root.querySelector(".rsvp__sheet");
  function animateSheet(change) {
    if (reduce || matchMedia("(min-width: 600px)").matches) { change(); return; }
    const parts = [evBox, $("rsvpCounts"), $("rsvpRegret")], was = parts.map(el => el.hidden);
    const h0 = sheet.offsetHeight; change(); const h1 = sheet.offsetHeight;
    parts.forEach((el, i) => { if (was[i] && !el.hidden) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: h1 > h0 ? 120 : 0, easing: "ease-out", fill: "backwards" }); });
    if (h0 === h1) return;
    sheet.style.overflow = "hidden";
    sheet.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 460, easing: "cubic-bezier(.65,0,.35,1)" })
      .finished.catch(() => {}).then(() => { sheet.style.overflow = ""; });
  }
  answer.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b && b.dataset.v !== answer.dataset.value) { animateSheet(() => setAnswer(b.dataset.v)); $("rsvpError").hidden = true; } });
  answer.addEventListener("keydown", e => {   // arrow keys move between the two options, as in any radio group
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault(); const v = accepting() ? "no" : "yes"; animateSheet(() => setAnswer(v)); answer.querySelector(`[data-v="${v}"]`).focus();
  });

  const chosen = () => accepting() ? [...evBox.querySelectorAll("input:checked")].map(i => i.value) : [];
  function sync() {
    const yes = accepting(), any = chosen().length > 0;
    evBox.hidden = !yes; $("rsvpCounts").hidden = !any; $("rsvpRegret").hidden = yes;
    answer.querySelectorAll("[data-v]").forEach(b => b.tabIndex = b.dataset.v === answer.dataset.value ? 0 : -1);
    $("rsvpSubmit").textContent = yes ? (record ? "Update RSVP" : "Send RSVP") : "Send my regrets";
  }
  evBox.addEventListener("change", sync);

  function fill(r) {
    evBox.querySelectorAll("input").forEach(i => i.checked = r && r.attending ? (r.events || []).includes(i.value) : !i.disabled);   // new guests (and past regrets): every open event ticked
    answer.dataset.value = r && !r.attending ? "no" : "yes";
    answer.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-checked", b.dataset.v === answer.dataset.value));
    setStep(steppers[0], r ? r.adults || 1 : 1); setStep(steppers[1], r ? r.kids || 0 : 0);
    $("rsvpNameInput").value = r?.name || name || "";
    $("rsvpSaved").hidden = !r;
    if (r) $("rsvpSaved").textContent = "Your answer from " + new Date(r.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) + " is filled in. Change anything and send again.";
    sync();
  }

  /* ---------- open / close ---------- */
  let record = null, lastFocus = null;
  function show(view) { form.hidden = view !== form; done.hidden = view !== done; }
  function open() {
    lastFocus = document.activeElement;
    name = inv.name || ($("protoName")?.value || "").trim();
    fill(record); show(form); $("rsvpError").hidden = true;
    root.hidden = false; document.documentElement.classList.add("rsvp-open");
    writeName();   // measure the name once the sheet has its width
    root.getBoundingClientRect(); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-in")));   // paint the closed position first so the slide-in always plays
    if (!name) setTimeout(() => $("rsvpNameInput").focus({ preventScroll: true }), reduce ? 0 : 350);
  }
  function close() {
    root.classList.remove("is-in"); document.documentElement.classList.remove("rsvp-open");
    setTimeout(() => { root.hidden = true; lastFocus?.focus?.({ preventScroll: true }); }, reduce ? 0 : 460);
  }
  btn.addEventListener("click", e => { e.stopPropagation(); open(); });
  root.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden) close(); });
  $("rsvpEdit").addEventListener("click", () => { fill(record); show(form); form.querySelector("input:not([hidden])")?.focus(); });

  /* ---------- submit ---------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const guestName = $("rsvpNameInput").value.trim() || name;
    const err = $("rsvpError");
    if (!guestName) { err.textContent = "Please add your name so the family knows who's replying."; err.hidden = false; $("rsvpNameInput").focus(); return; }
    const events = chosen(), attending = events.length > 0;
    if (accepting() && !attending) { err.textContent = "Choose at least one celebration, or select Regretfully decline."; err.hidden = false; return; }
    const r = { id: inv.id || "guest-" + guestName.toLowerCase().replace(/\W+/g, "-"), name: guestName,
      invited: inv.events.map(x => x.n).join(""), events, attending,
      adults: attending ? val("adults") : 0, kids: attending ? val("kids") : 0, updatedAt: new Date().toISOString() };
    const sub = $("rsvpSubmit"); sub.disabled = true; sub.textContent = "Sending…"; err.hidden = true;
    try { await save(r); }
    catch (_) { err.textContent = "We saved your answer on this phone, but couldn't send it just now. Please try again in a moment."; err.hidden = false; sub.disabled = false; sync(); return; }
    sub.disabled = false;
    const isUpdate = !!record; record = r; reflect(); thanks(r, isUpdate);
  });

  function thanks(r, isUpdate) {
    const picked = inv.events.filter(x => r.events.includes(x.n));
    $("rsvpDoneTitle").textContent = r.attending ? "Thank you" : "We’ll miss you";   // no name in the title: addressing someone by first name alone can read as too familiar
    $("rsvpDoneText").textContent = r.attending
      ? (isUpdate ? "Your RSVP has been updated. We can't wait to celebrate with you!" : "We can't wait to celebrate with you!")
      : "Thank you for letting us know. You'll be in our thoughts on the day.";
    const ppl = [`${r.adults} ${r.adults === 1 ? "guest" : "guests"}`, r.kids ? `${r.kids} ${r.kids === 1 ? "child" : "children"}` : ""].filter(Boolean).join(" and ");
    $("rsvpSummary").innerHTML = r.attending ? picked.map(x => `<li><span>${x.en}</span><span class="rsvp__hint">${x.when}</span></li>`).join("") + `<li class="rsvp__ppl">${ppl}</li>` : "";
    $("rsvpCal").hidden = !r.attending; $("rsvpDoneClose").hidden = r.attending;
    show(done); done.focus({ preventScroll: true });
    $("rsvpCalYes").onclick = () => { close(); window.AddToCalendar ? window.AddToCalendar.open(picked) : inv.downloadIcs(picked, "zubair-ayesha-my-events.ics"); };   // let them choose Apple, Google or Outlook
  }

  // the page's RSVP button says when there's already an answer
  function reflect() { btn.textContent = record ? (record.attending ? "Update your RSVP" : "Change your RSVP") : "RSVP"; }
  load().then(r => { record = r; reflect(); });
})();
