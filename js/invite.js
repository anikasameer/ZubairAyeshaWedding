/* Who this invite is for, read from the link.
   ?to=Imran%20and%20family   the guest's name (written by hand on the envelope, shown on the RSVP form)
   &e=123 | 23 | 3            which events they're invited to: 1 Mehendi & Nikkah · 2 Baraat · 3 Walima (default: all)
   &g=imran-khan              optional id for their RSVP (default: made from the name), so a returning guest finds their answer
   Uninvited events are removed from the page before anything else runs. */
(() => {
  const P = new URLSearchParams(location.search);
  const ALL = [
    { n: "1", code: "m", day: 3,  en: "Mehendi & Nikkah", when: "Thu, 3 December · 6:00 PM",
      ics: ["Mehendi & Nikkah — Zubair & Ayesha", "20261203T180000", "20261203T233000", "Red Castle Hotel, Sharjah, UAE", "https://maps.app.goo.gl/3uapPVN33KMwAh1v8"] },
    { n: "2", code: "b", day: 11, en: "Baraat", when: "Fri, 11 December · 6:00 PM",
      ics: ["Baraat — Zubair & Ayesha", "20261211T180000", "20261211T230000", "Occidental Sharjah Grand, Sharjah, UAE", "https://maps.app.goo.gl/42kiVg1pUCaV4gQe6"] },
    { n: "3", code: "v", day: 13, en: "Walima", when: "Sun, 13 December · 7:00 PM",
      ics: ["Walima — Zubair & Ayesha", "20261213T190000", "20261214T000000", "VOGO Grand Hotel, Dubai, UAE", "https://maps.app.goo.gl/Cen25zBpxUzVzatBA"] }];

  const want = (P.get("e") || "123").replace(/[^123]/g, "");
  const events = ALL.filter(e => want.includes(e.n));
  const invited = events.length ? events : ALL;
  const name = (P.get("to") || "").trim().slice(0, 80);
  const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 40);
  const id = (P.get("g") || "").trim().slice(0, 60) || (name ? slug(name) + "-" + invited.map(e => e.n).join("") : "");

  // A calendar file for any set of events (times in Gulf Standard Time)
  function ics(list) {
    const esc = t => t.replace(/[,;\\]/g, m => "\\" + m);
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zubair & Ayesha//Invite//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE", "TZID:Asia/Dubai", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0400", "TZOFFSETTO:+0400", "TZNAME:GST", "END:STANDARD", "END:VTIMEZONE",
      ...list.flatMap(e => { const [t, s, en, loc, url] = e.ics; return ["BEGIN:VEVENT", `UID:za-2026-${e.n}@zubair-ayesha.invite`, "DTSTAMP:20261121T000000Z",
        `DTSTART;TZID=Asia/Dubai:${s}`, `DTEND;TZID=Asia/Dubai:${en}`, `SUMMARY:${esc(t)}`, `LOCATION:${esc(loc)}`, `URL:${url}`, `DESCRIPTION:Map: ${url}`, "END:VEVENT"]; }),
      "END:VCALENDAR"].join("\r\n");
  }
  function downloadIcs(list, file = "zubair-ayesha-wedding.ics") {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([ics(list)], { type: "text/calendar" })), download: file });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  window.Invite = { name, id, all: ALL, events: invited, codes: invited.map(e => e.code), days: invited.map(e => e.day), ics, downloadIcs };

  // Remove the events this guest isn't invited to (before the accordion and calendar scripts run)
  document.querySelectorAll(".event[data-event-code]").forEach(el => { if (!window.Invite.codes.includes(el.dataset.eventCode)) el.remove(); });
})();
