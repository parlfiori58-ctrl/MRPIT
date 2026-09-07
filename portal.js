const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const { EmbedBuilder } = require("discord.js");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function generateRecordId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function sameText(a, b) {
  return String(a ?? "").trim().toLocaleLowerCase("it-IT") === String(b ?? "").trim().toLocaleLowerCase("it-IT");
}

function calculateAge(dateText) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dateText || ""));
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age;
}

function formatMoney(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "Non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome"
  }).format(date);
}

function createFineEmbed(fine, title = "📄 Verbale di contravvenzione") {
  const paid = fine.stato === "PAGATA";
  return new EmbedBuilder()
    .setColor(paid ? 0x57f287 : 0xed4245)
    .setTitle(title)
    .setDescription("Verbale amministrativo registrato nel database civile IPRP.")
    .addFields(
      {
        name: "Informazioni sul sanzionato",
        value: `**Generalità:** ${fine.nome} ${fine.cognome}\n**Utente Discord:** <@${fine.userId}>`,
        inline: false
      },
      {
        name: "Violazione contestata",
        value: `**Reato:** ${String(fine.reato).slice(0, 450)}\n**Descrizione:** ${String(fine.descrizione).slice(0, 550)}`,
        inline: false
      },
      {
        name: "Sanzione pecuniaria",
        value: `**Importo:** ${formatMoney(fine.importo)}\n**Stato:** ${paid ? "✅ PAGATA" : "⏳ PENDENTE"}\n**ID multa:** \`${fine.id}\``,
        inline: false
      },
      {
        name: "Dati dell’agente",
        value: `**Agente:** ${String(fine.agente).slice(0, 300)}\n**Emessa il:** ${formatDate(fine.creataIl)}`,
        inline: false
      }
    )
    .setFooter({ text: "IPRP • Registro sanzioni" })
    .setTimestamp(new Date(fine.creataIl));
}

function createArrestEmbed(arrest, title = "🚔 Registro di arresto") {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(title)
    .setDescription("Rapporto di arresto registrato nella fedina penale civile IPRP.")
    .addFields(
      {
        name: "Generalità dell’arrestato",
        value: `**Nome e cognome:** ${String(arrest.nomeCognome).slice(0, 250)}\n**Data di nascita:** ${arrest.dataNascita}\n**Età:** ${arrest.eta}\n**Cittadinanza:** ${String(arrest.cittadinanza).slice(0, 150)}\n**Città di residenza:** ${String(arrest.cittaResidenza).slice(0, 200)}\n**Numero di telefono:** ${String(arrest.numeroTelefono).slice(0, 250)}\n**Utente Discord:** <@${arrest.userId}>`,
        inline: false
      },
      {
        name: "Informazioni sull’arresto",
        value: `**Data dell’accaduto:** ${String(arrest.data).slice(0, 100)}\n**Reati:** ${String(arrest.reati).slice(0, 500)}\n**Descrizione:** ${String(arrest.descrizioneAccaduto).slice(0, 650)}`,
        inline: false
      },
      {
        name: "Dati dell’agente",
        value: `**Firma:** ${String(arrest.firmaAgente).slice(0, 300)}\n**ID arresto:** \`${arrest.id}\`\n**Registrato il:** ${formatDate(arrest.registratoIl)}`,
        inline: false
      }
    )
    .setFooter({ text: "IPRP • Fedina penale" })
    .setTimestamp(new Date(arrest.registratoIl));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cookieParse(header = "") {
  const result = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function sessionSignature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function createSession(user, secret) {
  const payload = Buffer.from(JSON.stringify({ user, expires: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sessionSignature(payload, secret)}`;
}

function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!safeEqual(signature, sessionSignature(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.user || !data.expires || data.expires < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function pageLayout(title, body, active = "dashboard", user = "FDO") {
  const nav = [
    ["dashboard", "/", "Dashboard", "▦"],
    ["cittadini", "/cittadini", "Cittadini", "♙"],
    ["multe", "/multe", "Multe", "▤"],
    ["arresti", "/arresti", "Fedina penale", "⚖"],
    ["targhe", "/targhe", "Veicoli", "◇"]
  ].map(([id, href, label, icon]) => `
    <a class="nav-item ${active === id ? "active" : ""}" href="${href}">
      <span class="nav-icon">${icon}</span><span>${label}</span>
    </a>`).join("");

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#08101f">
  <link rel="icon" type="image/png" href="/ced-iprp-logo.png">
  <link rel="apple-touch-icon" href="/ced-iprp-logo.png">
  <title>${escapeHtml(title)} • Portale FDO IPRP</title>
  <style>
    :root{
      --bg:#07101f;--bg2:#0a1628;--panel:#101e33;--panel2:#142640;--line:#213a5c;
      --text:#f1f6ff;--muted:#9fb3ce;--blue:#4d98ff;--cyan:#39d6ff;--green:#38d996;
      --red:#ff6674;--yellow:#f7c95d;--purple:#a879ff;--shadow:0 20px 60px rgba(0,0,0,.28)
    }
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:
      radial-gradient(circle at 82% -5%,rgba(57,214,255,.15),transparent 27%),
      radial-gradient(circle at 5% 5%,rgba(77,152,255,.18),transparent 30%),
      linear-gradient(145deg,var(--bg),var(--bg2));color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
    a{color:inherit}.shell{display:grid;grid-template-columns:255px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;padding:24px 17px;border-right:1px solid var(--line);background:rgba(7,16,31,.88);backdrop-filter:blur(18px);display:flex;flex-direction:column}
    .brand{display:flex;gap:13px;align-items:center;padding:8px 8px 25px}.crest-group{display:flex;align-items:center;gap:6px}.crest-secondary{width:42px;height:42px;border-radius:10px;object-fit:cover;border:1px solid rgba(255,255,255,.24);box-shadow:0 10px 24px rgba(0,0,0,.28)}.crest{width:54px;height:54px;border-radius:50%;object-fit:cover;display:block;border:1px solid rgba(128,184,255,.45);box-shadow:0 12px 34px rgba(0,0,0,.38)}.brand strong{font-size:16px;letter-spacing:.04em}.brand small{display:block;color:var(--muted);margin-top:3px}
    .nav{display:grid;gap:7px}.nav-item{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--muted);padding:12px 13px;border-radius:12px;border:1px solid transparent;transition:.18s}.nav-item:hover{color:#fff;background:rgba(20,38,64,.75)}.nav-item.active{color:#fff;background:linear-gradient(90deg,rgba(77,152,255,.22),rgba(57,214,255,.07));border-color:rgba(77,152,255,.33)}.nav-icon{width:26px;text-align:center;font-size:18px}
    .sidebar-bottom{margin-top:auto}.userbox{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:13px}.userbox small{color:var(--muted)}.logout{display:block;margin-top:10px;text-decoration:none;color:var(--red);font-size:13px}
    .content{min-width:0;padding:26px 30px 55px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:28px}.topbar h1{font-size:clamp(26px,4vw,43px);margin:0;letter-spacing:-.03em}.topbar p{color:var(--muted);margin:7px 0 0}.live{display:flex;align-items:center;gap:8px;border:1px solid rgba(56,217,150,.28);background:rgba(56,217,150,.08);color:#91f0c6;padding:9px 13px;border-radius:999px;white-space:nowrap}.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(56,217,150,.11)}
    .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.card{background:linear-gradient(180deg,rgba(20,38,64,.96),rgba(16,30,51,.96));border:1px solid var(--line);border-radius:18px;padding:19px;box-shadow:var(--shadow)}.span-3{grid-column:span 3}.span-4{grid-column:span 4}.span-5{grid-column:span 5}.span-6{grid-column:span 6}.span-7{grid-column:span 7}.span-8{grid-column:span 8}.span-12{grid-column:span 12}
    .stat-card{position:relative;overflow:hidden}.stat-card:after{content:"";position:absolute;width:110px;height:110px;border-radius:50%;right:-35px;top:-38px;background:radial-gradient(circle,rgba(77,152,255,.25),transparent 70%)}.label{color:var(--muted);font-size:13px}.stat{font-size:37px;font-weight:850;margin-top:7px;letter-spacing:-.03em}.accent-blue{color:#80b8ff}.accent-green{color:#74e6b5}.accent-red{color:#ff8c97}.accent-yellow{color:#f8dc8c}.accent-purple{color:#c4a6ff}
    .section-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:15px}.section-head h2{margin:0;font-size:19px}.subtle{color:var(--muted);font-size:13px}.bars{display:grid;gap:15px}.bar-row{display:grid;grid-template-columns:120px minmax(0,1fr) 45px;gap:12px;align-items:center}.track{height:12px;border-radius:999px;background:#071426;border:1px solid var(--line);overflow:hidden}.fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--blue),var(--cyan))}
    .search{display:flex;gap:9px;flex-wrap:wrap}.input,select{min-width:180px;flex:1;background:#09162a;color:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:inherit;outline:none}.input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(77,152,255,.1)}.button,button{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:12px 16px;background:linear-gradient(135deg,var(--blue),#3374df);color:white;font-weight:750;text-decoration:none;cursor:pointer;box-shadow:0 10px 24px rgba(77,152,255,.18)}.button.secondary{background:var(--panel2);box-shadow:none;border:1px solid var(--line)}.button.danger{background:#7f2430;box-shadow:none}.button.success{background:#176b4b;box-shadow:none}.actions{display:flex;gap:10px;flex-wrap:wrap}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:grid;gap:7px}.field.full{grid-column:1/-1}.field label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.field textarea{min-height:110px;resize:vertical}.input,textarea,select{width:100%;background:#09162a;color:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 13px;font:inherit;outline:none}.notice{padding:12px 14px;border-radius:10px;border:1px solid rgba(56,217,150,.28);background:rgba(56,217,150,.08);color:#b9f4d7;margin-bottom:16px}.notice.error{border-color:rgba(255,102,116,.35);background:rgba(255,102,116,.08);color:#ffc0c6}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--line);vertical-align:middle}th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.table-wrap{overflow:auto}.status{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}.ok{color:#7ce8b9;background:rgba(56,217,150,.12)}.bad{color:#ff9da6;background:rgba(255,102,116,.12)}.warn{color:#ffe09b;background:rgba(247,201,93,.12)}
    .kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kv div{border:1px solid var(--line);background:#0a172b;border-radius:12px;padding:12px}.kv small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}.record{border:1px solid var(--line);background:#0a172b;border-radius:14px;padding:14px;margin-bottom:10px}.record h3{margin:0 0 8px;font-size:16px}.record p{margin:5px 0;color:#dce8f8}.empty{text-align:center;color:var(--muted);padding:28px;border:1px dashed var(--line);border-radius:13px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.mobile-head{display:none}
    .donut{width:160px;height:160px;border-radius:50%;display:grid;place-items:center;margin:auto;background:conic-gradient(var(--green) 0 var(--paid),var(--red) var(--paid) 100%);position:relative}.donut:after{content:"";position:absolute;inset:22px;border-radius:50%;background:var(--panel)}.donut-center{position:relative;z-index:2;text-align:center}.donut-center strong{font-size:27px;display:block}
    @media(max-width:980px){body{padding-bottom:env(safe-area-inset-bottom)}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.shell{grid-template-columns:1fr}.sidebar{position:fixed;left:-290px;top:0;z-index:80;width:min(285px,86vw);height:100dvh;transition:left .22s ease;padding-top:calc(20px + env(safe-area-inset-top));box-shadow:20px 0 60px rgba(0,0,0,.5)}.sidebar.open{left:0}.content{padding:calc(12px + env(safe-area-inset-top)) 13px calc(34px + env(safe-area-inset-bottom))}.mobile-head{display:flex;position:sticky;top:0;z-index:40;align-items:center;justify-content:space-between;margin:-12px -13px 16px;padding:calc(10px + env(safe-area-inset-top)) 14px 11px;background:rgba(7,16,31,.92);border-bottom:1px solid var(--line);backdrop-filter:blur(18px)}.mobile-brand{display:flex;align-items:center;gap:9px}.mobile-logo-group{display:flex;align-items:center;gap:5px}.mobile-logo-secondary{width:30px;height:30px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.24)}.mobile-logo{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid rgba(128,184,255,.42)}.menu-btn{background:var(--panel);border:1px solid var(--line);box-shadow:none;padding:10px 13px;font-size:18px}.span-3,.span-4,.span-5,.span-6,.span-7,.span-8{grid-column:span 12}.topbar{align-items:flex-start;flex-direction:column;margin-bottom:18px}.topbar h1{font-size:30px}.topbar .actions{width:100%}.topbar .actions .button{flex:1;min-width:135px}.kv{grid-template-columns:1fr}.search{display:grid;grid-template-columns:1fr}.input,select,.search button{width:100%;min-width:0}.card{box-shadow:0 12px 35px rgba(0,0,0,.22)}.table-wrap{margin-left:-4px;margin-right:-4px;-webkit-overflow-scrolling:touch}.table-wrap table{min-width:720px}.record{overflow-wrap:anywhere}}
    @media(max-width:560px){.grid{gap:11px}.card{padding:14px;border-radius:14px}.bar-row{grid-template-columns:82px minmax(0,1fr) 32px;gap:8px}.live{font-size:12px;max-width:100%;white-space:normal}.stat{font-size:32px}.section-head{align-items:flex-start}.actions{width:100%}.actions .button{width:100%}th,td{padding:10px 8px}.button,button{min-height:44px}.login{border-radius:20px!important;padding:22px!important}}
  </style>
</head>
<body>
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <div class="brand"><div class="crest-group"><img class="crest" src="/ced-iprp-logo.png" alt="Minnesota Police"><img class="crest-secondary" src="/minnesota-state-patrol.png" alt="Minnesota State Patrol"></div><div><strong>PORTALE FDO</strong><small>IPRP • Sistema informativo FDO</small></div></div>
    <nav class="nav">${nav}</nav>
    <div class="sidebar-bottom"><div class="userbox"><small>Sessione attiva</small><strong style="display:block;margin-top:3px">${escapeHtml(user)}</strong><a class="logout" href="/logout">Esci dal portale</a></div></div>
  </aside>
  <main class="content">
    <div class="mobile-head"><div class="mobile-brand"><div class="mobile-logo-group"><img class="mobile-logo" src="/ced-iprp-logo.png" alt="Minnesota Police"><img class="mobile-logo-secondary" src="/minnesota-state-patrol.png" alt="Minnesota State Patrol"></div><strong>Portale FDO</strong></div><button class="menu-btn" aria-label="Apri menu" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button></div>
    ${body}
  </main>
</div>
<script>
  document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', () => document.getElementById('sidebar')?.classList.remove('open')));
  document.addEventListener('click', event => { const sidebar=document.getElementById('sidebar'); if(window.innerWidth<=980 && sidebar?.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('.menu-btn')) sidebar.classList.remove('open'); });
</script>
</body>
</html>`;
}

function loginPage(message = "") {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07101f"><link rel="icon" type="image/png" href="/ced-iprp-logo.png"><link rel="apple-touch-icon" href="/ced-iprp-logo.png"><title>Accesso • Portale FDO IPRP</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 15% 10%,rgba(77,152,255,.24),transparent 32%),radial-gradient(circle at 90% 0,rgba(168,121,255,.18),transparent 30%),#07101f;color:#f1f6ff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.login{width:min(430px,100%);background:linear-gradient(180deg,#142640,#101e33);border:1px solid #213a5c;border-radius:24px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.45)}.crest{width:112px;height:112px;border-radius:50%;display:block;object-fit:cover;border:1px solid rgba(128,184,255,.48);box-shadow:0 18px 48px rgba(0,0,0,.42);margin:0 auto 18px}h1{margin:0;font-size:31px;letter-spacing:-.03em}p{color:#9fb3ce;line-height:1.55}.field{margin-top:15px}label{display:block;color:#b8c8dd;font-size:13px;margin-bottom:7px}input{width:100%;border:1px solid #29466e;background:#09162a;color:white;border-radius:13px;padding:13px 14px;font:inherit;outline:none}input:focus{border-color:#4d98ff;box-shadow:0 0 0 3px rgba(77,152,255,.1)}button{width:100%;margin-top:20px;border:0;border-radius:13px;padding:13px;background:linear-gradient(135deg,#4d98ff,#3374df);color:white;font-weight:800;font-size:15px;cursor:pointer}.error{background:rgba(255,102,116,.12);border:1px solid rgba(255,102,116,.3);color:#ffb2b9;padding:10px 12px;border-radius:11px;margin-top:15px}.foot{text-align:center;font-size:12px;color:#7088a9;margin-top:18px}</style></head><body><form class="login" method="post" action="/login"><div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:18px"><img class="crest" style="margin:0" src="/ced-iprp-logo.png" alt="Minnesota Police"><img class="crest" style="width:82px;height:82px;margin:0;border-radius:14px" src="/minnesota-state-patrol.png" alt="Minnesota State Patrol"></div><h1>Accesso riservato</h1><p>Portale operativo delle Forze dell’Ordine IPRP. Inserisci le credenziali autorizzate.</p>${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}<div class="field"><label>Nome utente</label><input name="username" autocomplete="username" required></div><div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password" required></div><button type="submit">Accedi al portale</button><div class="foot">Connessione protetta • Accesso riservato agli operatori autorizzati</div></form></body></html>`;
}

function startFdoPortal({ databaseFile, port = 3000, client = null, arrestsChannelId = null }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));

  app.get("/ced-iprp-logo.png", (req, res) => {
    res.sendFile(path.join(__dirname, "ced-iprp-logo.png"));
  });
  app.get("/minnesota-state-patrol.png", (req, res) => {
    res.sendFile(path.join(__dirname, "minnesota-state-patrol.png"));
  });

  const expectedUser = process.env.PORTALE_USER || "fdo";
  const expectedPassword = process.env.PORTALE_PASSWORD || "";
  const sessionSecret = process.env.PORTALE_SECRET || expectedPassword || crypto.randomBytes(32).toString("hex");

  const operationsDir = path.join(path.dirname(databaseFile), "operazioni-elaborate");

  const claimOperation = operationId => {
    if (!operationId || !/^[a-zA-Z0-9_-]{12,100}$/.test(String(operationId))) return false;
    try {
      fs.mkdirSync(operationsDir, { recursive: true });
      const name = crypto.createHash("sha256").update(`portale:${operationId}`).digest("hex");
      const file = path.join(operationsDir, `${name}.lock`);
      const fd = fs.openSync(file, "wx");
      fs.writeFileSync(fd, JSON.stringify({ operationId, createdAt: new Date().toISOString() }), "utf8");
      fs.closeSync(fd);
      return true;
    } catch (error) {
      if (error?.code === "EEXIST") return false;
      console.error("Errore controllo duplicati portale:", error);
      return false;
    }
  };

  const readDb = () => {
    try {
      const db = JSON.parse(fs.readFileSync(databaseFile, "utf8"));
      db.utenti ||= {};
      db.richiesteDocumenti ||= {};
      db.multe ||= {};
      db.arresti ||= {};
      db.targhe ||= {};
      return db;
    } catch {
      return { utenti: {}, richiesteDocumenti: {}, multe: {}, arresti: {}, targhe: {}, ultimoAggiornamento: null };
    }
  };

  const writeDb = (db, reason = "portale") => {
    db.ultimoAggiornamento = new Date().toISOString();

    const dataDir = path.dirname(databaseFile);
    const temp = path.join(dataDir, "iprp_civili.portal.tmp.json");
    const previous = path.join(dataDir, "iprp_civili.previous.json");
    const backupDir = path.join(dataDir, "backups");

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    if (fs.existsSync(databaseFile)) {
      try {
        fs.copyFileSync(databaseFile, previous);
      } catch {}
    }

    fs.writeFileSync(temp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(temp, databaseFile);

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backup = path.join(backupDir, `iprp_civili-${stamp}-${reason}.json`);
      fs.copyFileSync(databaseFile, backup);

      const files = fs.readdirSync(backupDir)
        .filter(name => name.startsWith("iprp_civili-") && name.endsWith(".json"))
        .map(name => path.join(backupDir, name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

      for (const file of files.slice(30)) fs.unlinkSync(file);
    } catch {}
  };

  const sendDirectMessage = async (userId, payload) => {
    if (!client) return;
    try {
      const user = await client.users.fetch(userId);
      await user.send(payload);
    } catch {}
  };

  app.get("/health", (req, res) => res.status(200).json({ ok: true, service: "iprp-portale-fdo", time: new Date().toISOString() }));
  app.get("/login", (req, res) => res.send(loginPage()));
  app.post("/login", (req, res) => {
    if (!expectedPassword) return res.status(503).send(loginPage("PORTALE_PASSWORD non è configurata nel file .env."));
    const username = String(req.body.username || "");
    const password = String(req.body.password || "");
    if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) {
      return res.status(401).send(loginPage("Credenziali non valide."));
    }
    const token = createSession(username, sessionSecret);
    // Il flag Secure è obbligatorio solo con HTTPS. In sviluppo locale il
    // browser usa HTTP, quindi il cookie deve restare leggibile su localhost.
    const secureCookie = process.env.PORTALE_HTTPS === "true" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `iprp_session=${encodeURIComponent(token)}; Path=/; HttpOnly${secureCookie}; SameSite=Lax; Max-Age=43200`);
    return res.redirect("/");
  });
  app.get("/logout", (req, res) => {
    const secureCookie = process.env.PORTALE_HTTPS === "true" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `iprp_session=; Path=/; HttpOnly${secureCookie}; SameSite=Lax; Max-Age=0`);
    res.redirect("/login");
  });

  app.use((req, res, next) => {
    const session = verifySession(cookieParse(req.headers.cookie).iprp_session, sessionSecret);
    if (!session) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    req.portalUser = session.user;
    next();
  });

  app.get("/", (req, res) => {
    const db = readDb();
    const users = Object.values(db.utenti || {});
    const fines = Object.values(db.multe || {});
    const arrests = Object.values(db.arresti || {});
    const vehicles = Object.values(db.targhe || {});
    const citizens = users.filter(user => user.documento).length;
    const licenses = users.filter(user => user.patente).length;
    const pending = fines.filter(fine => fine.stato !== "PAGATA").length;
    const paid = fines.filter(fine => fine.stato === "PAGATA").length;
    const insured = vehicles.filter(vehicle => vehicle.assicurazione?.scadenza > Date.now()).length;
    const max = Math.max(citizens, licenses, fines.length, arrests.length, vehicles.length, 1);
    const paidPercentage = fines.length ? Math.round((paid / fines.length) * 100) : 0;
    const bars = [
      ["Cittadini", citizens], ["Patenti", licenses], ["Multe", fines.length], ["Arresti", arrests.length], ["Veicoli", vehicles.length]
    ].map(([label, value]) => `<div class="bar-row"><span>${label}</span><div class="track"><div class="fill" style="width:${Math.max(3, Math.round(value / max * 100))}%"></div></div><strong>${value}</strong></div>`).join("");

    const recent = [...fines].sort((a,b) => new Date(b.creataIl) - new Date(a.creataIl)).slice(0,5).map(fine => `<div class="record"><h3>${escapeHtml(fine.id)} <span class="status ${fine.stato === "PAGATA" ? "ok" : "warn"}">${escapeHtml(fine.stato)}</span></h3><p><strong>${escapeHtml(fine.nome)} ${escapeHtml(fine.cognome)}</strong> • ${formatMoney(fine.importo)}</p><p class="subtle">${escapeHtml(fine.reato)} • ${formatDate(fine.creataIl)}</p></div>`).join("") || '<div class="empty">Nessuna multa registrata.</div>';

    const body = `<div class="topbar"><div><h1>Dashboard operativa</h1><p>Quadro riepilogativo delle registrazioni operative.</p></div><div class="live"><span class="dot"></span> Servizio disponibile</div></div>
      <div class="grid">
        <div class="card stat-card span-3"><div class="label">Cittadini registrati</div><div class="stat accent-blue">${citizens}</div></div>
        <div class="card stat-card span-3"><div class="label">Patenti presenti</div><div class="stat accent-green">${licenses}</div></div>
        <div class="card stat-card span-3"><div class="label">Multe pendenti</div><div class="stat accent-red">${pending}</div></div>
        <div class="card stat-card span-3"><div class="label">Arresti registrati</div><div class="stat accent-yellow">${arrests.length}</div></div>
        <div class="card span-7"><div class="section-head"><h2>Consistenza degli archivi</h2><span class="subtle">Dati correnti</span></div><div class="bars">${bars}</div></div>
        <div class="card span-5"><div class="section-head"><h2>Stato multe</h2><span class="subtle">${fines.length} totali</span></div><div class="donut" style="--paid:${paidPercentage}%"><div class="donut-center"><strong>${paidPercentage}%</strong><span class="subtle">pagate</span></div></div><div style="display:flex;justify-content:center;gap:17px;margin-top:15px"><span class="status ok">${paid} pagate</span><span class="status warn">${pending} pendenti</span></div></div>
        <div class="card span-8"><div class="section-head"><h2>Consultazione fascicolo cittadino</h2></div><form class="search" action="/cittadini"><input class="input" name="q" placeholder="Nome, cognome, Roblox o ID Discord"><button>Cerca fascicolo</button></form></div>
        <div class="card span-4"><div class="label">Veicoli assicurati</div><div class="stat accent-purple">${insured}/${vehicles.length}</div><a class="button secondary" href="/targhe" style="margin-top:13px">Apri registro veicoli</a></div>
        <div class="card span-12"><div class="section-head"><h2>Ultimi verbali registrati</h2><a class="button secondary" href="/multe">Vedi tutte</a></div>${recent}</div>
      </div>`;
    res.send(pageLayout("Dashboard", body, "dashboard", req.portalUser));
  });

  app.get("/cittadini", (req, res) => {
    const db = readDb();
    const query = String(req.query.q || "").trim().toLowerCase();
    const entries = Object.entries(db.utenti || {}).filter(([, user]) => {
      if (!user.documento) return false;
      if (!query) return true;
      const haystack = [user.userId, user.documento.nome, user.documento.cognome, user.documento.nomeRoblox, user.documento.cittadinanza].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const rows = entries.map(([id, user]) => `<tr><td><strong>${escapeHtml(user.documento.nome)} ${escapeHtml(user.documento.cognome)}</strong><br><span class="subtle">${escapeHtml(user.documento.nomeRoblox || "-")}</span></td><td class="mono">${escapeHtml(id)}</td><td>${user.patente ? '<span class="status ok">Presente</span>' : '<span class="status bad">Assente</span>'}</td><td>${(user.multe || []).length}</td><td>${(user.fedinaPenale || []).length}</td><td><a class="button" href="/cittadino/${encodeURIComponent(id)}">Apri</a></td></tr>`).join("");
    const body = `<div class="topbar"><div><h1>Archivio cittadini</h1><p>Cerca e consulta il fascicolo completo di ogni cittadino.</p></div><div class="live">${entries.length} risultati</div></div><div class="card"><form class="search"><input class="input" name="q" value="${escapeHtml(req.query.q || "")}" placeholder="Nome, cognome, Roblox o Discord ID"><button>Cerca</button></form><div class="table-wrap" style="margin-top:15px">${rows ? `<table><thead><tr><th>Cittadino</th><th>ID Discord</th><th>Patente</th><th>Multe</th><th>Arresti</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Nessun cittadino trovato.</div>'}</div></div>`;
    res.send(pageLayout("Cittadini", body, "cittadini", req.portalUser));
  });

  app.get("/cittadino/:id/multa", (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const user = db.utenti?.[id];
    if (!user?.documento) return res.status(404).send(pageLayout("Cittadino non trovato", '<div class="card"><h1>Cittadino non trovato</h1></div>', "cittadini", req.portalUser));
    const d = user.documento;
    const operationId = crypto.randomUUID().replaceAll("-", "");
    const body = `<div class="topbar"><div><h1>Nuovo verbale di multa</h1><p>Registrazione amministrativa per ${escapeHtml(d.nome)} ${escapeHtml(d.cognome)}.</p></div><a class="button secondary" href="/cittadino/${encodeURIComponent(id)}">Torna al fascicolo</a></div>
      <div class="card"><form method="post" class="form-grid" onsubmit="const b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent='Registrazione in corso…';">
        <input type="hidden" name="operationId" value="${operationId}">
        <div class="field"><label>Utente Discord</label><input class="input mono" value="${escapeHtml(id)}" disabled></div>
        <div class="field"><label>Nome</label><input class="input" name="nome" value="${escapeHtml(d.nome)}" required></div>
        <div class="field"><label>Cognome</label><input class="input" name="cognome" value="${escapeHtml(d.cognome)}" required></div>
        <div class="field full"><label>Reato / violazione</label><input class="input" name="reato" maxlength="500" required></div>
        <div class="field"><label>Importo (€)</label><input class="input" type="number" min="1" max="100000000" name="importo" required></div>
        <div class="field"><label>Agente operante</label><input class="input" name="agente" maxlength="200" required></div>
        <div class="field full"><label>Descrizione dei fatti</label><textarea name="descrizione" maxlength="1000" required></textarea></div>
        <div class="field full"><button type="submit">Registra la multa</button></div>
      </form></div>`;
    res.send(pageLayout("Nuova multa", body, "multe", req.portalUser));
  });

  app.post("/cittadino/:id/multa", async (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const user = db.utenti?.[id];
    if (!user?.documento) return res.status(404).send("Cittadino non trovato");
    const d = user.documento;
    const nome = String(req.body.nome || "").trim();
    const cognome = String(req.body.cognome || "").trim();
    const importo = Number(req.body.importo);
    if (!sameText(nome, d.nome) || !sameText(cognome, d.cognome) || !Number.isFinite(importo) || importo < 1) {
      return res.status(400).send(pageLayout("Dati non validi", '<div class="card"><div class="notice error">I dati inseriti non corrispondono al documento oppure l’importo non è valido.</div><a class="button" href="/cittadino/'+encodeURIComponent(id)+'/multa">Torna al modulo</a></div>', "multe", req.portalUser));
    }
    const operationId = String(req.body.operationId || "");
    if (!claimOperation(`multa-${operationId}`)) {
      return res.redirect(`/cittadino/${encodeURIComponent(id)}?esito=duplicato`);
    }

    const fine = {
      id: generateRecordId("MUL"), userId: id, nome: d.nome, cognome: d.cognome,
      reato: String(req.body.reato || "").trim(), importo,
      descrizione: String(req.body.descrizione || "").trim(), agente: String(req.body.agente || "").trim(),
      agentePortale: req.portalUser, origine: "PORTALE_FDO", stato: "PENDENTE", creataIl: new Date().toISOString(), pagataIl: null
    };
    db.multe[fine.id] = fine;
    user.multe ||= [];
    user.multe.push(fine.id);
    writeDb(db, "multa-portale");
    await sendDirectMessage(id, {
      content: `Hai ricevuto una multa. Per pagarla usa \`/paga-multa\` con ID \`${fine.id}\`.`,
      embeds: [createFineEmbed(fine)]
    });
    res.redirect(`/cittadino/${encodeURIComponent(id)}?esito=multa`);
  });

  app.get("/cittadino/:id/arresto", (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const user = db.utenti?.[id];
    if (!user?.documento) return res.status(404).send(pageLayout("Cittadino non trovato", '<div class="card"><h1>Cittadino non trovato</h1></div>', "cittadini", req.portalUser));
    const d = user.documento;
    const age = calculateAge(d.dataNascita);
    const operationId = crypto.randomUUID().replaceAll("-", "");
    const body = `<div class="topbar"><div><h1>Registrazione arresto</h1><p>Inserimento nel casellario di ${escapeHtml(d.nome)} ${escapeHtml(d.cognome)}.</p></div><a class="button secondary" href="/cittadino/${encodeURIComponent(id)}">Torna al fascicolo</a></div>
      <div class="card"><form method="post" class="form-grid" onsubmit="const b=this.querySelector('button[type=submit]');b.disabled=true;b.textContent='Registrazione in corso…';">
        <input type="hidden" name="operationId" value="${operationId}">
        <div class="field"><label>Utente arrestato (Discord)</label><input class="input mono" value="${escapeHtml(id)}" disabled></div>
        <div class="field"><label>Nome</label><input class="input" name="nome" value="${escapeHtml(d.nome)}" required></div>
        <div class="field"><label>Cognome</label><input class="input" name="cognome" value="${escapeHtml(d.cognome)}" required></div>
        <div class="field"><label>Data di nascita</label><input class="input" name="dataNascita" value="${escapeHtml(d.dataNascita)}" required></div>
        <div class="field"><label>Cittadinanza</label><input class="input" name="cittadinanza" value="${escapeHtml(d.cittadinanza)}" required></div>
        <div class="field"><label>Città di residenza</label><input class="input" name="cittaResidenza" maxlength="100" required></div>
        <div class="field"><label>Età</label><input class="input" type="number" name="eta" value="${escapeHtml(age)}" min="0" max="150" required></div>
        <div class="field"><label>Numero di telefono</label><input class="input" name="numeroTelefono" maxlength="100" required></div>
        <div class="field full"><label>Reati contestati</label><textarea name="reati" maxlength="1000" required></textarea></div>
        <div class="field full"><label>Descrizione dell’accaduto</label><textarea name="descrizioneAccaduto" maxlength="1000" required></textarea></div>
        <div class="field full"><label>Firma agente</label><input class="input" name="firmaAgente" maxlength="200" required></div>
        <div class="field full"><button type="submit">Registra l’arresto</button></div>
      </form></div>`;
    res.send(pageLayout("Nuovo arresto", body, "arresti", req.portalUser));
  });

  app.post("/cittadino/:id/arresto", async (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const user = db.utenti?.[id];
    if (!user?.documento) return res.status(404).send("Cittadino non trovato");
    const d = user.documento;
    const age = calculateAge(d.dataNascita);
    const valid = sameText(req.body.nome, d.nome) && sameText(req.body.cognome, d.cognome) && sameText(req.body.dataNascita, d.dataNascita) && sameText(req.body.cittadinanza, d.cittadinanza) && Number(req.body.eta) === age;
    if (!valid) return res.status(400).send(pageLayout("Dati non validi", '<div class="card"><div class="notice error">Le generalità non corrispondono al documento del cittadino.</div><a class="button" href="/cittadino/'+encodeURIComponent(id)+'/arresto">Torna al modulo</a></div>', "arresti", req.portalUser));
    const operationId = String(req.body.operationId || "");
    if (!claimOperation(`arresto-${operationId}`)) {
      return res.redirect(`/cittadino/${encodeURIComponent(id)}?esito=duplicato`);
    }

    const now = Date.now();
    const arrest = {
      id: generateRecordId("ARR"), userId: id, nome: d.nome, cognome: d.cognome, nomeCognome: `${d.nome} ${d.cognome}`,
      dataNascita: d.dataNascita, cittadinanza: d.cittadinanza,
      cittaResidenza: String(req.body.cittaResidenza || "").trim(), eta: age,
      numeroTelefono: String(req.body.numeroTelefono || "").trim(), reati: String(req.body.reati || "").trim(),
      descrizioneAccaduto: String(req.body.descrizioneAccaduto || "").trim(), firmaAgente: String(req.body.firmaAgente || "").trim(),
      agentePortale: req.portalUser, origine: "PORTALE_FDO", data: formatDate(now), dataEventoTimestamp: now,
      registratoIl: new Date(now).toISOString(), registratoTimestamp: now
    };
    db.arresti[arrest.id] = arrest;
    user.fedinaPenale ||= [];
    user.fedinaPenale.push(arrest.id);
    writeDb(db, "arresto-portale");
    await sendDirectMessage(id, {
      content: "È stato registrato un arresto nella tua fedina penale.",
      embeds: [createArrestEmbed(arrest)]
    });
    if (client && arrestsChannelId) {
      try {
        const channel = await client.channels.fetch(arrestsChannelId);
        if (channel?.isTextBased()) {
          await channel.send({
            content: `Nuovo arresto registrato per <@${id}>.`,
            embeds: [createArrestEmbed(arrest)]
          });
        }
      } catch {}
    }
    res.redirect(`/cittadino/${encodeURIComponent(id)}?esito=arresto`);
  });

  app.get("/cittadino/:id", (req, res) => {
    const db = readDb();
    const id = req.params.id;
    const user = db.utenti?.[id];
    if (!user?.documento) return res.status(404).send(pageLayout("Non trovato", '<div class="card"><h1>Cittadino non trovato</h1><p class="subtle">Il profilo richiesto non esiste o non possiede un documento approvato.</p></div>', "cittadini", req.portalUser));
    const d = user.documento;
    const p = user.patente;
    const fines = (user.multe || []).map(fid => db.multe?.[fid]).filter(Boolean);
    const arrests = (user.fedinaPenale || []).map(aid => db.arresti?.[aid]).filter(Boolean);
    const vehicles = (user.auto || []).map(targa => db.targhe?.[targa]).filter(Boolean);
    const fineCards = fines.length ? fines.map(f => `<div class="record"><h3>${escapeHtml(f.id)} <span class="status ${f.stato === "PAGATA" ? "ok" : "warn"}">${escapeHtml(f.stato)}</span></h3><p><strong>Reato:</strong> ${escapeHtml(f.reato)}</p><p><strong>Importo:</strong> ${formatMoney(f.importo)} • <strong>Data:</strong> ${formatDate(f.creataIl)}</p><p>${escapeHtml(f.descrizione)}</p></div>`).join("") : '<div class="empty">Nessuna multa registrata.</div>';
    const arrestCards = arrests.length ? arrests.map(a => `<div class="record"><h3>${escapeHtml(a.id)}</h3><p><strong>Reati:</strong> ${escapeHtml(a.reati)}</p><p><strong>Registrato:</strong> ${formatDate(a.registratoIl)} • <strong>Agente:</strong> ${escapeHtml(a.firmaAgente)}</p><p>${escapeHtml(a.descrizioneAccaduto)}</p></div>`).join("") : '<div class="empty">Fedina penale pulita.</div>';
    const vehicleCards = vehicles.length ? vehicles.map(v => `<div class="record"><h3>${escapeHtml(v.modello)} • <span class="mono">${escapeHtml(v.targa)}</span></h3><p><strong>Colore:</strong> ${escapeHtml(v.colore)} • <strong>Cerchioni:</strong> ${escapeHtml(v.cerchioni)} • <strong>Gancio:</strong> ${v.gancio ? "Presente" : "Assente"}</p><p><strong>Assicurazione:</strong> ${v.assicurazione?.scadenza > Date.now() ? `${escapeHtml(v.assicurazione.piano)} fino al ${formatDate(v.assicurazione.scadenza)}` : "Non assicurata"}</p></div>`).join("") : '<div class="empty">Nessun veicolo intestato.</div>';
    const notice = req.query.esito === "multa"
      ? '<div class="notice">Multa registrata correttamente.</div>'
      : req.query.esito === "arresto"
        ? '<div class="notice">Arresto registrato correttamente.</div>'
        : req.query.esito === "duplicato"
          ? '<div class="notice">La richiesta era già stata elaborata. Non è stata creata una seconda registrazione.</div>'
          : '';
    const body = `<div class="topbar"><div><h1>${escapeHtml(d.nome)} ${escapeHtml(d.cognome)}</h1><p>Fascicolo anagrafico e operativo.</p></div><div class="actions"><a class="button" href="/cittadino/${encodeURIComponent(id)}/multa">Registra multa</a><a class="button danger" href="/cittadino/${encodeURIComponent(id)}/arresto">Registra arresto</a></div></div>${notice}<div class="grid">
      <div class="card span-6"><div class="section-head"><h2>Documento</h2><span class="status ok">Approvato</span></div><div class="kv"><div><small>Nome</small>${escapeHtml(d.nome)}</div><div><small>Cognome</small>${escapeHtml(d.cognome)}</div><div><small>Data di nascita</small>${escapeHtml(d.dataNascita)}</div><div><small>Cittadinanza</small>${escapeHtml(d.cittadinanza)}</div><div><small>Roblox</small>${escapeHtml(d.nomeRoblox)}</div><div><small>Approvato il</small>${formatDate(d.approvatoIl)}</div></div></div>
      <div class="card span-6"><div class="section-head"><h2>Patente</h2>${p ? '<span class="status ok">Presente</span>' : '<span class="status bad">Assente</span>'}</div>${p ? `<div class="kv"><div><small>Punti</small>${escapeHtml(p.punti)}/20</div><div><small>Registrata</small>${formatDate(p.registrataIl)}</div><div><small>Stato</small>${p.sequestrataFinoAl > Date.now() ? "Sequestrata" : "Regolare"}</div><div><small>Restituzione</small>${p.sequestrataFinoAl > Date.now() ? formatDate(p.sequestrataFinoAl) : "-"}</div></div>` : '<div class="empty">Nessuna patente registrata.</div>'}</div>
      <div class="card span-4"><div class="label">Saldo bancario</div><div class="stat accent-green">${formatMoney(user.conto?.banca)}</div><div class="subtle">${formatMoney(user.conto?.contanti)} in contanti</div></div>
      <div class="card span-4"><div class="label">Multe totali</div><div class="stat accent-red">${fines.length}</div><div class="subtle">${fines.filter(f => f.stato !== "PAGATA").length} non pagate</div></div>
      <div class="card span-4"><div class="label">Arresti registrati</div><div class="stat accent-yellow">${arrests.length}</div><div class="subtle">Fedina penale</div></div>
      <div class="card span-12"><div class="section-head"><h2>Multe</h2></div>${fineCards}</div>
      <div class="card span-12"><div class="section-head"><h2>Casellario penale</h2></div>${arrestCards}</div>
      <div class="card span-12"><div class="section-head"><h2>Veicoli intestati</h2></div>${vehicleCards}</div>
    </div>`;
    res.send(pageLayout(`${d.nome} ${d.cognome}`, body, "cittadini", req.portalUser));
  });

  app.get("/multe", (req, res) => {
    const db = readDb();
    const filter = String(req.query.stato || "tutte").toUpperCase();
    const query = String(req.query.q || "").toLowerCase().trim();
    const fines = Object.values(db.multe || {}).filter(f => (filter === "TUTTE" || f.stato === filter) && (!query || `${f.id} ${f.nome} ${f.cognome} ${f.reato}`.toLowerCase().includes(query))).sort((a,b) => new Date(b.creataIl)-new Date(a.creataIl));
    const rows = fines.map(f => `<tr><td class="mono">${escapeHtml(f.id)}</td><td><strong>${escapeHtml(f.nome)} ${escapeHtml(f.cognome)}</strong></td><td>${escapeHtml(f.reato)}</td><td>${formatMoney(f.importo)}</td><td><span class="status ${f.stato === "PAGATA" ? "ok" : "warn"}">${escapeHtml(f.stato)}</span></td><td>${formatDate(f.creataIl)}</td><td><a class="button" href="/cittadino/${encodeURIComponent(f.userId)}">Profilo</a></td></tr>`).join("");
    const body = `<div class="topbar"><div><h1>Registro multe</h1><p>Tutte le sanzioni pagate e pendenti.</p></div><div class="live">${fines.length} risultati</div></div><div class="card"><form class="search"><input class="input" name="q" value="${escapeHtml(req.query.q || "")}" placeholder="ID, cittadino o reato"><select name="stato"><option value="tutte">Tutte</option><option value="PENDENTE" ${filter === "PENDENTE" ? "selected" : ""}>Pendenti</option><option value="PAGATA" ${filter === "PAGATA" ? "selected" : ""}>Pagate</option></select><button>Filtra</button></form><div class="table-wrap" style="margin-top:15px">${rows ? `<table><thead><tr><th>ID</th><th>Cittadino</th><th>Reato</th><th>Importo</th><th>Stato</th><th>Data</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Nessuna multa trovata.</div>'}</div></div>`;
    res.send(pageLayout("Multe", body, "multe", req.portalUser));
  });

  app.get("/arresti", (req, res) => {
    const db = readDb();
    const query = String(req.query.q || "").toLowerCase().trim();
    const arrests = Object.values(db.arresti || {}).filter(a => !query || `${a.id} ${a.nomeCognome} ${a.reati} ${a.firmaAgente}`.toLowerCase().includes(query)).sort((a,b)=>new Date(b.registratoIl)-new Date(a.registratoIl));
    const cards = arrests.map(a => `<div class="record"><h3>${escapeHtml(a.id)} • ${escapeHtml(a.nomeCognome)}</h3><p><strong>Reati:</strong> ${escapeHtml(a.reati)}</p><p><strong>Agente:</strong> ${escapeHtml(a.firmaAgente)} • <strong>Data:</strong> ${formatDate(a.registratoIl)}</p><p>${escapeHtml(a.descrizioneAccaduto)}</p><a class="button secondary" href="/cittadino/${encodeURIComponent(a.userId)}">Apri fascicolo</a></div>`).join("") || '<div class="empty">Nessun arresto registrato.</div>';
    const body = `<div class="topbar"><div><h1>Fedina penale</h1><p>Registro completo degli arresti e dei precedenti.</p></div><div class="live">${arrests.length} arresti</div></div><div class="card"><form class="search"><input class="input" name="q" value="${escapeHtml(req.query.q || "")}" placeholder="ID, cittadino, reato o agente"><button>Cerca</button></form><div style="margin-top:16px">${cards}</div></div>`;
    res.send(pageLayout("Fedina penale", body, "arresti", req.portalUser));
  });

  app.get("/targhe", (req, res) => {
    const db = readDb();
    const query = String(req.query.q || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const vehicles = Object.values(db.targhe || {}).filter(v => !query || String(v.targa).includes(query));
    const rows = vehicles.map(v => `<tr><td class="mono">${escapeHtml(v.targa)}</td><td>${escapeHtml(v.modello)}</td><td>${escapeHtml(v.nome)} ${escapeHtml(v.cognome)}</td><td>${escapeHtml(v.colore)}</td><td>${v.assicurazione?.scadenza > Date.now() ? `<span class="status ok">${escapeHtml(v.assicurazione.piano)}</span>` : '<span class="status bad">Non assicurata</span>'}</td><td><a class="button" href="/cittadino/${encodeURIComponent(v.userId)}">Intestatario</a></td></tr>`).join("");
    const body = `<div class="topbar"><div><h1>Registro veicoli</h1><p>Controllo targhe, intestatari e assicurazioni.</p></div><div class="live">${vehicles.length} veicoli</div></div><div class="card"><form class="search"><input class="input" name="q" value="${escapeHtml(req.query.q || "")}" placeholder="Inserisci una targa"><button>Controlla</button></form><div class="table-wrap" style="margin-top:15px">${rows ? `<table><thead><tr><th>Targa</th><th>Modello</th><th>Intestatario</th><th>Colore</th><th>Assicurazione</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">Nessuna targa trovata.</div>'}</div></div>`;
    res.send(pageLayout("Veicoli", body, "targhe", req.portalUser));
  });

  app.use((req, res) => {
    res.status(404).send(pageLayout("Pagina non trovata", '<div class="card"><h1>Pagina non trovata</h1><p class="subtle">Il collegamento richiesto non esiste. Torna alla dashboard.</p><a class="button" href="/">Dashboard</a></div>', "dashboard", req.portalUser));
  });

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Portale FDO attivo sulla porta ${port}`);
  });
  return server;
}

module.exports = { startFdoPortal };
