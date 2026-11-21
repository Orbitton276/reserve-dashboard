/* Shared sign-in for the whole site.
 *
 * The existing pages read public views and keep working signed out. Pages that read or
 * change protected data (Clearance) call RS.ready() and show a prompt if nobody is signed
 * in. What a signed-in person can read or change is decided by the database (inventory
 * grants and role permissions), never by this file.
 */
(function () {
  const URL_ = "https://bqibfhhhthfzawzkpsdr.supabase.co";
  const KEY = "sb_publishable_NYRPrV7chJz-X5MTfyTr9Q_caqJ7A4v";
  const lib = window.supabase;
  const sb = lib.createClient(URL_, KEY);
  const db = lib.createClient(URL_, KEY, { db: { schema: "v2" } });
  const listeners = [];
  // Roles that may change data from the web, for now. This only decides which buttons
  // are shown; the database refuses a write from anyone without the grant or permission.
  const WRITE_ROLES = ["admin", "M4"];
  const RS = { sb, db, session: null, me: null, canWrite: false, onChange: fn => listeners.push(fn) };
  window.RS = RS;

  const css = document.createElement("style");
  css.textContent = `
    header.site .grow { flex:1; }
    .site-gate { text-align:center; padding:60px 16px; }
    .site-gate p { color:var(--muted); margin:0 0 16px; }
    .site-gate button { padding:12px 20px; font-size:16px; font-weight:700; border:0; border-radius:8px; background:var(--head); color:var(--headfg); cursor:pointer; }
    header.site .who { font-size:13px; color:rgba(255,255,255,.8); }
    header.site button.auth { background:rgba(255,255,255,.15); color:#fff; border:0; border-radius:8px; padding:6px 12px; font-size:14px; cursor:pointer; }
    dialog.signin { border:1px solid var(--line); border-radius:12px; background:var(--bg); color:var(--fg); padding:20px; width:min(340px,92vw); }
    /* Phones: the header wraps onto two rows (brand + account, then the page links), wide
       tables scroll inside themselves instead of widening the page. */
    @media (max-width: 640px) {
      header.site .in { flex-wrap:wrap; height:auto; gap:0 12px; padding:6px 12px; }
      header.site .brand { order:1; font-size:17px; margin:0; }
      header.site .grow { order:2; }
      header.site .who { order:3; max-width:38vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
      header.site button.auth { order:4; padding:5px 10px; font-size:13px; }
      header.site .brk { order:5; flex-basis:100%; height:0; }
      header.site a { order:6; height:40px; font-size:14px; }
      main { padding:12px; }
      table { display:block; overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .ghead { flex-wrap:wrap; }
      h1 { font-size:18px; }
    }
    dialog.signin::backdrop { background:rgba(0,0,0,.45); }
    dialog.signin h2 { margin:0 0 12px; font-size:18px; }
    dialog.signin input { width:100%; padding:12px; font-size:16px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); margin-bottom:8px; }
    dialog.signin .go { width:100%; padding:12px; font-size:16px; font-weight:700; border:0; border-radius:8px; background:var(--head); color:var(--headfg); cursor:pointer; }
    dialog.signin .go:disabled { opacity:.5; }
    dialog.signin .err { color:var(--bad); font-size:14px; min-height:1.2em; margin:6px 0; }
    dialog.signin .x { margin-top:8px; width:100%; background:none; border:0; color:var(--muted); cursor:pointer; }`;
  document.head.appendChild(css);

  const bar = document.querySelector("header.site .in");
  const grow = document.createElement("span"); grow.className = "grow";
  const who = document.createElement("span"); who.className = "who";
  const btn = document.createElement("button"); btn.className = "auth"; btn.type = "button";
  const brk = document.createElement("span"); brk.className = "brk";
  bar.append(grow, who, btn, brk);

  const dlg = document.createElement("dialog"); dlg.className = "signin";
  dlg.innerHTML = `<form method="dialog" id="rsForm"><h2>Sign in</h2>
    <input id="rsEmail" type="email" autocomplete="username" placeholder="Email" required>
    <input id="rsPw" type="password" autocomplete="current-password" placeholder="Password" required>
    <div class="err" id="rsErr"></div>
    <button class="go" id="rsGo" type="submit">Sign in</button>
    <button class="x" id="rsX" type="button">Cancel</button></form>`;
  document.body.appendChild(dlg);
  const $ = id => dlg.querySelector("#" + id);
  $("rsEmail").value = "orbitton276@gmail.com";

  // The whole site needs a sign-in. A page that draws its own prompt (it has #gate) is left alone.
  const main = document.querySelector("main");
  let siteGate = null;
  if (main && !document.getElementById("gate")) {
    siteGate = document.createElement("div"); siteGate.className = "site-gate";
    siteGate.innerHTML = '<p>Sign in to see this page.</p><button type="button">Sign in</button>';
    siteGate.querySelector("button").addEventListener("click", () => RS.open());
    main.parentNode.insertBefore(siteGate, main);
  }

  async function loadMe(session) {
    RS.me = null; RS.canWrite = false;
    if (!session) return;
    const u = await db.from("users").select("personal_id,first_name,last_name,role_id").eq("auth_id", session.user.id).maybeSingle();
    if (!u.data) return;
    const r = u.data.role_id != null ? await db.from("roles").select("name").eq("id", u.data.role_id).maybeSingle() : null;
    RS.me = { id: u.data.personal_id, name: `${u.data.first_name ?? ""} ${u.data.last_name ?? ""}`.trim(), role: r?.data?.name ?? null };
    RS.canWrite = WRITE_ROLES.includes(RS.me.role);
  }

  async function apply() {
    const { data } = await sb.auth.getSession();
    RS.session = data.session;
    if (data.session) await db.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    await loadMe(data.session);
    if (siteGate) { siteGate.style.display = data.session ? "none" : ""; main.style.display = data.session ? "" : "none"; }
    who.textContent = data.session ? (RS.me ? `${RS.me.name}${RS.me.role ? " · " + RS.me.role : ""}` : data.session.user.email) : "";
    btn.textContent = data.session ? "Sign out" : "Sign in";
    listeners.forEach(fn => fn(data.session));
  }
  RS.open = () => { $("rsErr").textContent = ""; dlg.showModal(); $("rsPw").focus(); };
  RS.ready = apply;

  btn.addEventListener("click", async () => {
    if (RS.session) { await sb.auth.signOut(); await db.auth.signOut(); await apply(); }
    else RS.open();
  });
  $("rsX").addEventListener("click", () => dlg.close());
  $("rsForm").addEventListener("submit", async e => {
    e.preventDefault(); $("rsErr").textContent = ""; $("rsGo").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $("rsEmail").value.trim(), password: $("rsPw").value });
    $("rsPw").value = ""; $("rsGo").disabled = false;
    if (error) { $("rsErr").textContent = error.message; return; }
    dlg.close(); apply();
  });
  RS.first = apply();
})();
