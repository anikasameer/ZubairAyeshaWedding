/* "Add to calendar" chooser: the guest picks where their events go.
   Apple Calendar and any other app take one .ics file with every event; Google Calendar and Outlook open their own
   "new event" pages, one per event (that's how their links work), so with several events each gets its own row.
   Usage: AddToCalendar.open(events)   (events from window.Invite) */
(() => {
  const inv = window.Invite; if (!inv) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const iso = t => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:00+04:00`;
  const links = e => {
    const [title, s, en, loc, url] = e.ics, details = `Map: ${url}`;
    return {
      google: "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${s}/${en}`, ctz: "Asia/Dubai", location: loc, details }),
      outlook: "https://outlook.live.com/calendar/0/deeplink/compose?" + new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: title, startdt: iso(s), enddt: iso(en), location: loc, body: details }) };
  };

  const root = document.createElement("div");
  root.className = "rsvp addcal"; root.hidden = true;
  root.innerHTML = `<div class="rsvp__scrim" data-close></div>
    <div class="rsvp__sheet" role="dialog" aria-modal="true" aria-labelledby="addcalTitle">
      <button class="btn btn--tertiary btn--lg btn--icon rsvp__close" type="button" data-close aria-label="Close"><span class="icon" aria-hidden="true">close</span></button>
      <div class="rsvp__view">
        <div class="rsvp__head"><p class="t-h3 rsvp__title" id="addcalTitle">Add to your calendar</p></div>
        <div class="rsvp__body">
        <p class="t-body-2 rsvp__intro" id="addcalIntro"></p>
        <div class="addcal__options">
          <button class="btn btn--secondary btn--block t-button" type="button" data-app="apple">Apple Calendar</button>
          <button class="btn btn--secondary btn--block t-button" type="button" data-app="google">Google Calendar</button>
          <button class="btn btn--secondary btn--block t-button" type="button" data-app="outlook">Outlook</button>
          <button class="btn btn--tertiary btn--block t-button" type="button" data-app="ics">Other calendar app (download file)</button>
        </div>
        <ul class="rsvp__summary addcal__list" id="addcalList" hidden></ul>
        <button class="btn btn--tertiary btn--sm t-button addcal__back" type="button" data-back hidden><span class="icon" aria-hidden="true">arrow_back</span>Choose another calendar</button>
        </div>
      </div>
    </div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  let current = [];

  function open(events) {
    current = events && events.length ? events : inv.events;
    choices();
    root.hidden = false; root.getBoundingClientRect(); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-in")));   // paint the closed position first so the slide-in always plays
  }
  function choices() {   // the first step: pick a calendar
    $("#addcalIntro").textContent = current.length > 1
      ? `Choose where to save your ${current.length} events.` : `Choose where to save ${current[0].en}.`;
    $("#addcalList").hidden = true; $("[data-back]").hidden = true; $(".addcal__options").hidden = false;
  }
  function close() { root.classList.remove("is-in"); setTimeout(() => { root.hidden = true; }, reduce ? 0 : 460); }

  root.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-back]")) { choices(); $("[data-app]").focus(); return; }
    const b = e.target.closest("[data-app]"); if (!b) return;
    const app = b.dataset.app;
    if (app === "apple" || app === "ics") { inv.downloadIcs(current); close(); return; }
    if (current.length === 1) { window.open(links(current[0])[app], "_blank", "noopener"); close(); return; }
    // several events: one link each (Google and Outlook add one event per link)
    const list = $("#addcalList");
    list.innerHTML = current.map(ev => `<li><span><span class="check-row__title">${ev.en}</span><br><span class="t-caption rsvp__hint">${ev.when}</span></span>
      <a class="btn btn--secondary btn--sm t-button" href="${links(ev)[app]}" target="_blank" rel="noopener">Add</a></li>`).join("");
    $("#addcalIntro").textContent = `Tap Add for each event. ${app === "google" ? "Google Calendar" : "Outlook"} opens with the details filled in.`;
    $(".addcal__options").hidden = true; list.hidden = false; $("[data-back]").hidden = false;
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden) close(); });

  window.AddToCalendar = { open, close, links };
})();
