// The parent's consent page. The link in the email is .../consent/#<token>: the token stays in the
// URL fragment, which browsers never send to a server. This page reads it, shows what the app
// collects, and sends the decision to the API (the same routes the API's own HTML page uses).
"use strict";

(async () => {
  const api = String(window.KINETRA_API || "").replace(/\/+$/, "") + "/api/v1/consent/parental/";
  const token = decodeURIComponent(location.hash.slice(1));
  const main = document.getElementById("content");
  let texts = {};
  try {
    texts = (await (await fetch("texts.json", { cache: "no-store" })).json()).T;
  } catch {
    texts = {};
  }
  const t = (lang) => texts[lang] || texts.en || {};

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const c of children) node.append(c);
    return node;
  };
  const show = (lang, ...nodes) => {
    document.documentElement.lang = lang;
    document.title = t(lang).title || "Kinetra";
    document.getElementById("title").textContent = t(lang).title || "Kinetra";
    main.replaceChildren(...nodes);
  };
  const message = (lang, key) => {
    // The link is used up (or invalid): drop the token from the address bar and history.
    history.replaceState(null, "", location.pathname);
    show(lang, el("div", { class: "card" }, el("p", {}, t(lang)[key] || key)));
  };

  if (!/^[\w-]{20,200}$/.test(token)) return message("en", "invalid");

  let info;
  try {
    const res = await fetch(api + encodeURIComponent(token), { headers: { Accept: "application/json" } });
    if (!res.ok) return message("en", "invalid");
    info = await res.json();
  } catch {
    return message("en", "invalid");
  }
  const lang = info.locale;
  const tx = t(lang);

  const decide = async (decision, buttons) => {
    buttons.forEach((b) => (b.disabled = true));
    try {
      const res = await fetch(api + encodeURIComponent(token), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ decision }),
      });
      if (!res.ok) return message(res.status === 404 ? "en" : lang, "invalid");
      const out = await res.json();
      message(lang, out.result);
    } catch {
      buttons.forEach((b) => (b.disabled = false));
    }
  };

  const agree = el("button", { class: "agree", type: "button" }, tx.agree);
  const refuse = el("button", { class: "refuse", type: "button" }, tx.refuse);
  agree.addEventListener("click", () => decide("grant", [agree, refuse]));
  refuse.addEventListener("click", () => decide("refuse", [agree, refuse]));

  show(
    lang,
    el("p", {}, String(tx.intro).replace("{child}", info.child_email)),
    el(
      "div",
      { class: "card" },
      el("p", {}, tx.what),
      el("h2", {}, tx.collects),
      el("ul", {}, ...tx.items.map((i) => el("li", {}, i))),
      el("h2", {}, tx.never),
      el("ul", {}, ...tx.never_items.map((i) => el("li", {}, i))),
      el("p", {}, tx.rights),
    ),
    agree,
    refuse,
  );
})();
