const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
require("dotenv").config();
const { startFdoPortal } = require("./portal");

const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CONFIGURAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CANALE_DOCUMENTI = "1543228824471339088";
const CANALE_RICHIESTE_CITTADINANZA = "1543228800735903767";
const CANALE_LOG_PATENTI = "1544081942545301584";
const CANALE_LOG_BONIFICI = "1544082087290871950";
const CANALE_ARRESTI = "1544082160191803452";

const PORTALE_FDO_PORT = Number(process.env.PORT || 3000);
const PORTALE_FDO_URL = process.env.PORTALE_FDO_URL || "https://mrp-database-departments.up.railway.app/login";

const RUOLO_TURISTA = "1360353746005004372";
const RUOLO_CITTADINO = "1543228774164725782";
const RUOLO_POLIZIA = "1360353746005004377";
const RUOLO_STAFF = "1543228774743810140";
const RUOLO_NUOVO_PLAYER = "1543228774164725781";
const RUOLO_CITTADINANZA_APPROVATA = "1543228774164725782";
const RUOLO_AUTOMATICO_BASE = "1543228774164725783";

const RUOLI_AUTOMATICI = [RUOLO_NUOVO_PLAYER, RUOLO_AUTOMATICO_BASE];

const BANCA_INIZIALE = 15000;
const CONTANTI_INIZIALI = 0;

const ASSICURAZIONI = {
  base: { nome: "Base", prezzo: 1000, servizi: "Responsabilità civile essenziale" },
  standard: { nome: "Standard", prezzo: 2500, servizi: "Responsabilità civile, furto e incendio" },
  premium: { nome: "Premium", prezzo: 5000, servizi: "Copertura completa, furto, incendio e danni al veicolo" }
};
const DURATA_ASSICURAZIONE_MS = 30 * 24 * 60 * 60 * 1000;

// In locale i dati restano nella cartella del progetto, anche quando VS Code
// viene avviato da una directory diversa.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const DATABASE_FILE = path.join(DATA_DIR, "iprp_civili.json");
const DATABASE_TEMP_FILE = `${DATABASE_FILE}.tmp`;
const DATABASE_PREVIOUS_FILE = path.join(DATA_DIR, "iprp_civili.previous.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const OPERAZIONI_DIR = path.join(DATA_DIR, "operazioni-elaborate");
const NUMERO_BACKUP_DA_MANTENERE = 30;
const INTERVALLO_BACKUP_MS = 10 * 60 * 1000;
const TIMER_MASSIMO = 2_147_000_000;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ Inserisci DISCORD_TOKEN, CLIENT_ID e GUILD_ID nel file .env");
  process.exit(1);
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CLIENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const timerSequestri = new Map();
let timerPresenza = null;
let timerBackup = null;

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COLORI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const COLORI = {
  blu: 0x3498db,
  verde: 0x57f287,
  rosso: 0xed4245,
  giallo: 0xfee75c,
  viola: 0x9b59b6,
  grigio: 0x2b2d31
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  NAZIONALITÀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const NAZIONALITA = [
  "Italiana", "Spagnola", "Francese", "Tedesca", "Portoghese", "Inglese",
  "Irlandese", "Scozzese", "Gallese", "Svizzera", "Austriaca", "Belga",
  "Olandese", "Lussemburghese", "Danese", "Svedese", "Norvegese",
  "Finlandese", "Islandese", "Polacca", "Ceca", "Slovacca", "Ungherese",
  "Rumena", "Bulgara", "Greca", "Albanese", "Croata", "Serba",
  "Bosniaca", "Slovena", "Montenegrina", "Macedone", "Kosovara",
  "Ucraina", "Russa", "Bielorussa", "Moldava", "Lituana", "Lettone",
  "Estone", "Turca", "Israeliana", "Palestinese", "Marocchina",
  "Algerina", "Tunisina", "Egiziana", "Libica", "Senegalese",
  "Nigeriana", "Ghanese", "Sudafricana", "Etiope", "Somala", "Keniota",
  "Statunitense", "Canadese", "Messicana", "Brasiliana", "Argentina",
  "Colombiana", "Venezuelana", "Cilena", "Peruviana", "Cubana",
  "Dominicana", "Cinese", "Giapponese", "Coreana", "Indiana",
  "Pakistana", "Bangladese", "Filippina", "Thailandese", "Vietnamita",
  "Indonesiana", "Australiana", "Neozelandese"
];

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DATABASE E BACKUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function creaDatabaseVuoto() {
  return {
    versione: 3,
    utenti: {},
    richiesteDocumenti: {},
    multe: {},
    arresti: {},
    targhe: {},
    servizioStaff: {},
    pannelloCittadinanzaInviatoIl: null,
    ultimoAggiornamento: new Date().toISOString()
  };
}

function creaUtenteVuoto(userId) {
  return {
    userId,
    documento: null,
    patente: null,
    conto: {
      banca: BANCA_INIZIALE,
      contanti: CONTANTI_INIZIALI
    },
    multe: [],
    fedinaPenale: [],
    auto: []
  };
}

function preparaDatiUtente(utente, userId) {
  let modificato = false;

  if (!utente.userId) {
    utente.userId = userId;
    modificato = true;
  }
  if (!Object.hasOwn(utente, "documento")) {
    utente.documento = null;
    modificato = true;
  }
  if (!Object.hasOwn(utente, "patente")) {
    utente.patente = null;
    modificato = true;
  }
  if (!utente.conto || typeof utente.conto !== "object") {
    utente.conto = { banca: BANCA_INIZIALE, contanti: CONTANTI_INIZIALI };
    modificato = true;
  }
  if (typeof utente.conto.banca !== "number" || !Number.isFinite(utente.conto.banca)) {
    utente.conto.banca = BANCA_INIZIALE;
    modificato = true;
  }
  if (typeof utente.conto.contanti !== "number" || !Number.isFinite(utente.conto.contanti)) {
    utente.conto.contanti = CONTANTI_INIZIALI;
    modificato = true;
  }
  if (!Array.isArray(utente.multe)) {
    utente.multe = [];
    modificato = true;
  }
  if (!Array.isArray(utente.fedinaPenale)) {
    utente.fedinaPenale = [];
    modificato = true;
  }
  if (!Array.isArray(utente.auto)) {
    utente.auto = [];
    modificato = true;
  }

  return modificato;
}

function normalizzaDatabase(database) {
  let modificato = false;

  if (!database || typeof database !== "object") {
    return { database: creaDatabaseVuoto(), modificato: true };
  }
  if (!database.utenti || typeof database.utenti !== "object") {
    database.utenti = {};
    modificato = true;
  }
  if (!database.richiesteDocumenti || typeof database.richiesteDocumenti !== "object") {
    database.richiesteDocumenti = {};
    modificato = true;
  }
  if (!database.multe || typeof database.multe !== "object") {
    database.multe = {};
    modificato = true;
  }
  if (!database.arresti || typeof database.arresti !== "object") {
    database.arresti = {};
    modificato = true;
  }
  if (!database.targhe || typeof database.targhe !== "object") {
    database.targhe = {};
    modificato = true;
  }
  if (!database.servizioStaff || typeof database.servizioStaff !== "object") {
    database.servizioStaff = {};
    modificato = true;
  }
  if (!Object.hasOwn(database, "pannelloCittadinanzaInviatoIl")) {
    database.pannelloCittadinanzaInviatoIl = null;
    modificato = true;
  }
  if (!database.versione) {
    database.versione = 3;
    modificato = true;
  }

  for (const [userId, utente] of Object.entries(database.utenti)) {
    if (preparaDatiUtente(utente, userId)) modificato = true;
  }

  return { database, modificato };
}

function scriviJsonAtomico(filePath, dati) {
  const testo = JSON.stringify(dati, null, 2);

  // Conserva sempre anche l’ultima versione valida precedente.
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, DATABASE_PREVIOUS_FILE);
    } catch (errore) {
      console.error("⚠️ Non sono riuscito a creare la copia precedente:", errore.message);
    }
  }

  fs.writeFileSync(DATABASE_TEMP_FILE, testo, "utf8");
  fs.renameSync(DATABASE_TEMP_FILE, filePath);
}

function salvaDatabase(database) {
  database.ultimoAggiornamento = new Date().toISOString();
  scriviJsonAtomico(DATABASE_FILE, database);
}

function elencoBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(nome => nome.startsWith("iprp_civili-") && nome.endsWith(".json"))
    .map(nome => path.join(BACKUP_DIR, nome))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function creaBackupDatabase(motivo = "automatico") {
  try {
    if (!fs.existsSync(DATABASE_FILE)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const ora = new Date();
    const nomeData = ora.toISOString().replace(/[:.]/g, "-");
    const destinazione = path.join(BACKUP_DIR, `iprp_civili-${nomeData}-${motivo}.json`);
    fs.copyFileSync(DATABASE_FILE, destinazione);

    const backup = elencoBackup();
    for (const file of backup.slice(NUMERO_BACKUP_DA_MANTENERE)) {
      fs.unlinkSync(file);
    }
  } catch (errore) {
    console.error("❌ Errore durante il backup del database:", errore);
  }
}

function recuperaDaBackup() {
  for (const file of elencoBackup()) {
    try {
      const database = JSON.parse(fs.readFileSync(file, "utf8"));
      const normalizzato = normalizzaDatabase(database).database;
      salvaDatabase(normalizzato);
      console.log(`✅ Database recuperato dal backup: ${path.basename(file)}`);
      return normalizzato;
    } catch {
      // Prova il backup successivo.
    }
  }
  return null;
}

function caricaDatabase() {
  if (!fs.existsSync(DATABASE_FILE)) {
    const database = creaDatabaseVuoto();
    salvaDatabase(database);
    creaBackupDatabase("iniziale");
    return database;
  }

  try {
    const letto = JSON.parse(fs.readFileSync(DATABASE_FILE, "utf8"));
    const { database, modificato } = normalizzaDatabase(letto);
    if (modificato) salvaDatabase(database);
    return database;
  } catch (errore) {
    console.error("❌ Database principale danneggiato, provo il recupero:", errore.message);

    if (fs.existsSync(DATABASE_PREVIOUS_FILE)) {
      try {
        const precedente = JSON.parse(fs.readFileSync(DATABASE_PREVIOUS_FILE, "utf8"));
        const normalizzato = normalizzaDatabase(precedente).database;
        salvaDatabase(normalizzato);
        console.log("✅ Database recuperato dalla copia precedente.");
        return normalizzato;
      } catch {}
    }

    const recuperato = recuperaDaBackup();
    if (recuperato) return recuperato;

    const danneggiato = `${DATABASE_FILE}.danneggiato-${Date.now()}`;
    try {
      fs.copyFileSync(DATABASE_FILE, danneggiato);
    } catch {}

    const nuovo = creaDatabaseVuoto();
    salvaDatabase(nuovo);
    return nuovo;
  }
}

function ottieniUtente(userId) {
  const database = caricaDatabase();
  if (!database.utenti[userId]) {
    database.utenti[userId] = creaUtenteVuoto(userId);
    salvaDatabase(database);
  } else if (preparaDatiUtente(database.utenti[userId], userId)) {
    salvaDatabase(database);
  }
  return database.utenti[userId];
}

function aggiornaUtente(userId, funzione) {
  const database = caricaDatabase();
  const utente = database.utenti[userId] ?? creaUtenteVuoto(userId);
  preparaDatiUtente(utente, userId);
  const aggiornato = funzione(structuredClone(utente));
  preparaDatiUtente(aggiornato, userId);
  database.utenti[userId] = aggiornato;
  salvaDatabase(database);
  return database.utenti[userId];
}

function avviaBackupPeriodico() {
  if (timerBackup) clearInterval(timerBackup);
  creaBackupDatabase("avvio");
  timerBackup = setInterval(() => creaBackupDatabase("automatico"), INTERVALLO_BACKUP_MS);
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BLOCCO ANTI-DUPLICAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function prenotaOperazioneUnica(chiave) {
  try {
    fs.mkdirSync(OPERAZIONI_DIR, { recursive: true });
    const nome = crypto.createHash("sha256").update(String(chiave)).digest("hex");
    const file = path.join(OPERAZIONI_DIR, `${nome}.lock`);
    const fd = fs.openSync(file, "wx");
    fs.writeFileSync(fd, JSON.stringify({ chiave, creataIl: new Date().toISOString() }), "utf8");
    fs.closeSync(fd);
    return true;
  } catch (errore) {
    if (errore?.code === "EEXIST") return false;
    console.error("❌ Errore controllo duplicati:", errore);
    return false;
  }
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FUNZIONI UTILI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function controllaDataNascita(dataTesto) {
  const risultato = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dataTesto);
  if (!risultato) return null;

  const giorno = Number(risultato[1]);
  const mese = Number(risultato[2]);
  const anno = Number(risultato[3]);
  const data = new Date(anno, mese - 1, giorno);

  const valida = data.getFullYear() === anno && data.getMonth() === mese - 1 && data.getDate() === giorno;
  if (!valida || data > new Date()) return null;
  return { giorno, mese, anno, data };
}

function calcolaEta(dataTesto) {
  const nascita = controllaDataNascita(dataTesto);
  if (!nascita) return null;

  const oggi = new Date();
  let eta = oggi.getFullYear() - nascita.anno;
  const compleannoPassato = oggi.getMonth() > nascita.mese - 1 ||
    (oggi.getMonth() === nascita.mese - 1 && oggi.getDate() >= nascita.giorno);
  if (!compleannoPassato) eta--;
  return eta;
}

function formattaDataOra(timestamp) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Europe/Rome"
  }).format(new Date(timestamp));
}

function formattaSoldi(importo) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(importo);
}

function convertiDurataInMillisecondi(durata, unita) {
  if (unita === "minuti") return durata * 60 * 1000;
  if (unita === "ore") return durata * 60 * 60 * 1000;
  if (unita === "giorni") return durata * 24 * 60 * 60 * 1000;
  return null;
}

function formattaDurata(durata, unita) {
  if (unita === "minuti") return durata === 1 ? "1 minuto" : `${durata} minuti`;
  if (unita === "ore") return durata === 1 ? "1 ora" : `${durata} ore`;
  if (unita === "giorni") return durata === 1 ? "1 giorno" : `${durata} giorni`;
  return `${durata} ${unita}`;
}

function generaId(prefisso) {
  const casuale = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefisso}-${casuale}`;
}

function troncaTesto(testo, massimo = 1024) {
  const valore = String(testo ?? "");
  return valore.length <= massimo ? valore : `${valore.slice(0, massimo - 3)}...`;
}

function dividiInBlocchi(testo, massimo = 3900) {
  const righe = String(testo).split("\n");
  const blocchi = [];
  let corrente = "";

  for (const riga of righe) {
    if ((corrente + riga + "\n").length > massimo) {
      if (corrente) blocchi.push(corrente.trim());
      corrente = `${riga}\n`;
    } else {
      corrente += `${riga}\n`;
    }
  }
  if (corrente.trim()) blocchi.push(corrente.trim());
  return blocchi;
}

function testoUguale(a, b) {
  return String(a ?? "").trim().toLocaleLowerCase("it-IT") ===
    String(b ?? "").trim().toLocaleLowerCase("it-IT");
}

function controllaDocumentoEGeneralita(userId, nome, cognome) {
  const utente = ottieniUtente(userId);

  if (!utente.documento) {
    return {
      valido: false,
      messaggio: "❌ L’utente selezionato non possiede un documento approvato."
    };
  }

  if (!testoUguale(nome, utente.documento.nome) || !testoUguale(cognome, utente.documento.cognome)) {
    return {
      valido: false,
      messaggio: `❌ Nome e cognome non corrispondono al documento. Devi inserire **${utente.documento.nome} ${utente.documento.cognome}**.`
    };
  }

  return { valido: true, utente, documento: utente.documento };
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RUOLI E PERMESSI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function assegnaRuoliAutomatici(membro) {
  if (membro.user.bot) return;

  const ruoliMancanti = RUOLI_AUTOMATICI.filter(
    ruoloId => !membro.roles.cache.has(ruoloId)
  );

  if (!ruoliMancanti.length) return;

  for (const ruoloId of ruoliMancanti) {
    try {
      const ruolo =
        membro.guild.roles.cache.get(ruoloId) ??
        await membro.guild.roles.fetch(ruoloId).catch(() => null);

      if (!ruolo) {
        console.error(`❌ Ruolo automatico non trovato: ${ruoloId}`);
        continue;
      }

      if (!ruolo.editable) {
        console.error(
          `❌ Non posso assegnare il ruolo ${ruolo.name} (${ruoloId}). ` +
          "Sposta il ruolo del bot più in alto nella gerarchia."
        );
        continue;
      }

      await membro.roles.add(
        ruolo,
        "Ruolo automatico assegnato al nuovo membro"
      );
    } catch (errore) {
      console.error(
        `❌ Errore assegnazione ruolo automatico ${ruoloId}:`,
        errore
      );
    }
  }
}

async function trasformaInCittadino(guild, userId) {
  try {
    const membro = await guild.members.fetch(userId);
    for (const ruoloDaRimuovere of [RUOLO_NUOVO_PLAYER]) {
      if (membro.roles.cache.has(ruoloDaRimuovere)) {
        await membro.roles.remove(ruoloDaRimuovere, "Documento approvato");
      }
    }
    if (!membro.roles.cache.has(RUOLO_CITTADINANZA_APPROVATA)) {
      await membro.roles.add(RUOLO_CITTADINANZA_APPROVATA, "Documento approvato");
    }
  } catch (errore) {
    console.error("❌ Errore cambio ruoli:", errore);
  }
}

client.on(Events.GuildMemberAdd, assegnaRuoliAutomatici);

async function ottieniMembroInterazione(interaction) {
  if (!interaction.guild) return null;
  try {
    return await interaction.guild.members.fetch(interaction.user.id);
  } catch {
    return null;
  }
}

function eStaff(membro) {
  if (membro.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return membro.roles.cache.has(RUOLO_STAFF);
}

function ruoloUgualeOSuperiore(membro, ruoloBase) {
  return membro.roles.highest.position >= ruoloBase.position;
}

async function haLivelloPoliziaOStaff(interaction, membro) {
  if (eStaff(membro)) return true;
  return membro.roles.cache.has(RUOLO_POLIZIA);
}

async function haLivelloCittadinoOSuperiore(interaction, membro) {
  if (eStaff(membro)) return true;
  const ruoloBase = interaction.guild.roles.cache.get(RUOLO_CITTADINO) ??
    await interaction.guild.roles.fetch(RUOLO_CITTADINO).catch(() => null);
  return Boolean(ruoloBase && ruoloUgualeOSuperiore(membro, ruoloBase));
}

async function controllaPermessoComando(interaction) {
  const membro = await ottieniMembroInterazione(interaction);
  if (!membro) {
    await interaction.reply({
      content: "❌ Questo comando può essere usato solamente nel server.",
      flags: MessageFlags.Ephemeral
    });
    return false;
  }

  const comando = interaction.commandName;
  if (comando === "registra-documento") {
    await interaction.reply({ content: "Questo comando è disattivato.", flags: MessageFlags.Ephemeral });
    return false;
  }

  const soloStaff = new Set([
    "rimuovi-documento",
    "rimuovi-patente",
    "rimuovi-multa",
    "rimuovi-arrestato",
    "aggiungi-punti-patente",
    "immatricola-auto",
    "reset-auto",
    "embed",
    "servizio"
  ]);

  const poliziaOStaff = new Set([
    "decreta-punti-patente",
    "sequestro-patente",
    "multa",
    "controllo-multe",
    "registra-arresto",
    "controlla-fedina-penale",
    "controlla-targa",
    "portale"
  ]);

  if (soloStaff.has(comando)) {
    if (!eStaff(membro)) {
      await interaction.reply({
        content: `❌ Solo chi possiede il ruolo <@&${RUOLO_STAFF}> può usare questo comando.`,
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    return true;
  }

  if (poliziaOStaff.has(comando)) {
    if (!await haLivelloPoliziaOStaff(interaction, membro)) {
      await interaction.reply({
        content: `❌ Serve il ruolo <@&${RUOLO_POLIZIA}> o superiore, oppure il ruolo <@&${RUOLO_STAFF}>.`,
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    return true;
  }

  if (!await haLivelloCittadinoOSuperiore(interaction, membro)) {
    await interaction.reply({
      content: `❌ Serve il ruolo <@&${RUOLO_CITTADINO}> o un ruolo superiore.`,
      flags: MessageFlags.Ephemeral
    });
    return false;
  }

  return true;
}

async function puoGestireRichiesteDocumento(interaction) {
  const membro = await ottieniMembroInterazione(interaction);
  return Boolean(membro && (eStaff(membro) || membro.permissions.has(PermissionFlagsBits.ManageGuild)));
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SEQUESTRO PATENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function patenteSequestrata(patente) {
  return Boolean(patente?.sequestrataFinoAl && patente.sequestrataFinoAl > Date.now());
}

function controllaSequestroScaduto(userId) {
  const utente = ottieniUtente(userId);
  if (!utente.patente?.sequestrataFinoAl) return;
  if (utente.patente.sequestrataFinoAl <= Date.now()) {
    aggiornaUtente(userId, dati => {
      if (dati.patente) {
        dati.patente.sequestrataIl = null;
        dati.patente.sequestrataFinoAl = null;
      }
      return dati;
    });
  }
}

async function restituisciPatente(userId) {
  const utente = ottieniUtente(userId);
  if (!utente.patente?.sequestrataFinoAl) {
    timerSequestri.delete(userId);
    return;
  }

  const scadenza = utente.patente.sequestrataFinoAl;
  if (scadenza > Date.now()) {
    programmaRestituzionePatente(userId, scadenza);
    return;
  }

  aggiornaUtente(userId, dati => {
    if (dati.patente) {
      dati.patente.sequestrataIl = null;
      dati.patente.sequestrataFinoAl = null;
    }
    return dati;
  });

  timerSequestri.delete(userId);
  try {
    const utenteDiscord = await client.users.fetch(userId);
    await utenteDiscord.send({
      embeds: [new EmbedBuilder()
        .setColor(COLORI.verde)
        .setTitle("✅ Patente restituita")
        .setDescription("Il periodo di sequestro è terminato. La patente è stata restituita automaticamente.")
        .setTimestamp()]
    });
  } catch {}
}

function programmaRestituzionePatente(userId, scadenza) {
  const precedente = timerSequestri.get(userId);
  if (precedente) clearTimeout(precedente);

  const tempo = scadenza - Date.now();
  if (tempo <= 0) {
    void restituisciPatente(userId);
    return;
  }

  const timer = setTimeout(async () => {
    timerSequestri.delete(userId);
    await restituisciPatente(userId);
  }, Math.min(tempo, TIMER_MASSIMO));

  timerSequestri.set(userId, timer);
}

async function ripristinaTimerSequestri() {
  const database = caricaDatabase();
  for (const [userId, utente] of Object.entries(database.utenti)) {
    const scadenza = utente.patente?.sequestrataFinoAl;
    if (!scadenza) continue;
    if (scadenza <= Date.now()) await restituisciPatente(userId);
    else programmaRestituzionePatente(userId, scadenza);
  }
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EMBED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function creaEmbedDocumento(documento, titolo = "🪪 Documento d’identità") {
  return new EmbedBuilder()
    .setColor(COLORI.blu)
    .setTitle(titolo)
    .addFields(
      { name: "Nome", value: documento.nome, inline: true },
      { name: "Cognome", value: documento.cognome, inline: true },
      { name: "Età", value: `${calcolaEta(documento.dataNascita)} anni`, inline: true },
      { name: "Data di nascita", value: documento.dataNascita, inline: true },
      { name: "Cittadinanza", value: documento.cittadinanza, inline: true },
      { name: "Nome Roblox", value: documento.nomeRoblox, inline: true }
    )
    .setFooter({ text: "Documento civile" })
    .setTimestamp();
}

function creaEmbedPatente(patente) {
  const sequestrata = patenteSequestrata(patente);
  const punti = Math.max(0, Math.min(20, Number(patente.punti) || 0));
  const pieni = Math.round(punti / 2);
  const barra = `${"🟩".repeat(pieni)}${"⬛".repeat(10 - pieni)}`;

  const embed = new EmbedBuilder()
    .setColor(sequestrata ? COLORI.rosso : COLORI.giallo)
    .setTitle("🪪 PATENTE DI GUIDA")
    .setDescription(
      sequestrata
        ? "### 🚫 PATENTE TEMPORANEAMENTE SEQUESTRATA"
        : "### ✅ PATENTE REGOLARE E UTILIZZABILE"
    )
    .addFields(
      {
        name: "👤 Intestatario",
        value: `**${patente.nome} ${patente.cognome}**`,
        inline: false
      },
      {
        name: "📊 Punti disponibili",
        value: `${barra}
**${punti}/20 punti**`,
        inline: false
      },
      {
        name: "📅 Registrata il",
        value: patente.registrataIl ? formattaDataOra(patente.registrataIl) : "Data non disponibile",
        inline: false
      }
    );

  if (sequestrata) {
    embed.addFields(
      {
        name: "⛔ Sequestrata il",
        value: patente.sequestrataIl ? formattaDataOra(patente.sequestrataIl) : "Non disponibile",
        inline: true
      },
      {
        name: "✅ Restituzione prevista",
        value: formattaDataOra(patente.sequestrataFinoAl),
        inline: true
      }
    );
  }

  return embed
    .setFooter({ text: "MPRP • Archivio patenti civili" })
    .setTimestamp();
}

function creaEmbedPortafoglioDocumento(documento) {
  return creaEmbedDocumento(documento, `👛 Portafoglio di ${documento.nome} ${documento.cognome}`)
    .setFooter({ text: "Pagina 1 di 4 • Documento" });
}

function creaEmbedPortafoglioConto(documento, conto) {
  return new EmbedBuilder()
    .setColor(COLORI.verde)
    .setTitle(`💳 Conto di ${documento.nome} ${documento.cognome}`)
    .addFields(
      { name: "💵 Contanti", value: `**${formattaSoldi(conto.contanti)}**`, inline: true },
      { name: "🏦 Banca", value: `**${formattaSoldi(conto.banca)}**`, inline: true },
      { name: "💰 Totale", value: `**${formattaSoldi(conto.contanti + conto.banca)}**`, inline: false }
    )
    .setFooter({ text: "Pagina 2 di 4 • Conto" })
    .setTimestamp();
}

function creaEmbedPortafoglioPatente(patente) {
  return creaEmbedPatente(patente).setFooter({ text: "Pagina 3 di 4 • Patente" });
}


function assicurazioneAttiva(auto) {
  return Boolean(auto.assicurazione?.scadenza && auto.assicurazione.scadenza > Date.now());
}

function creaEmbedPortafoglioAuto(documento, auto) {
  const embed = new EmbedBuilder()
    .setColor(COLORI.viola)
    .setTitle(`🚘 Veicoli di ${documento.nome} ${documento.cognome}`)
    .setFooter({ text: "Pagina 4 di 4 • Veicoli" })
    .setTimestamp();

  if (!auto.length) {
    return embed.setDescription("Non risultano veicoli immatricolati a tuo nome.");
  }

  const descrizione = auto.map((veicolo, indice) => {
    const attiva = assicurazioneAttiva(veicolo);
    const stato = attiva
      ? `✅ ${veicolo.assicurazione.piano} — scadenza ${formattaDataOra(veicolo.assicurazione.scadenza)}`
      : "❌ Non assicurata";
    return `**${indice + 1}. ${veicolo.modello}**
Targa: \`${veicolo.targa}\`
Colore: ${veicolo.colore}
Cerchioni: ${veicolo.cerchioni}
Gancio: ${veicolo.gancio ? "Presente" : "Non presente"}
Assicurazione: ${stato}`;
  }).join("\n\n");

  return embed.setDescription(troncaTesto(descrizione, 4000));
}

function creaEmbedMulta(multa, titolo = "📄 Verbale di contravvenzione") {
  const stato = multa.stato === "PAGATA" ? "✅ PAGATA" : "⏳ PENDENTE";
  return new EmbedBuilder()
    .setColor(multa.stato === "PAGATA" ? COLORI.verde : COLORI.rosso)
    .setTitle(titolo)
    .setDescription("Verbale amministrativo registrato nel database civile MPRP.")
    .addFields(
      { name: "Informazioni sul sanzionato", value: `**Generalità:** ${multa.nome} ${multa.cognome}\n**Utente Discord:** <@${multa.userId}>`, inline: false },
      { name: "Violazione contestata", value: `**Reato:** ${troncaTesto(multa.reato, 450)}\n**Descrizione:** ${troncaTesto(multa.descrizione, 550)}`, inline: false },
      { name: "Sanzione pecuniaria", value: `**Importo:** ${formattaSoldi(multa.importo)}\n**Stato:** ${stato}\n**ID multa:** \`${multa.id}\``, inline: false },
      { name: "Dati dell’agente", value: `**Agente:** ${troncaTesto(multa.agente, 300)}\n**Emessa il:** ${formattaDataOra(multa.creataIl)}`, inline: false }
    )
    .setFooter({ text: "MPRP • Registro sanzioni" })
    .setTimestamp(new Date(multa.creataIl));
}

function creaEmbedArresto(arresto, titolo = "🚔 Registro di arresto") {
  return new EmbedBuilder()
    .setColor(COLORI.rosso)
    .setTitle(titolo)
    .setDescription("Rapporto di arresto registrato nella fedina penale civile MPRP.")
    .addFields(
      {
        name: "Generalità dell’arrestato",
        value: `**Nome e cognome:** ${troncaTesto(arresto.nomeCognome, 250)}\n**Data di nascita:** ${arresto.dataNascita}\n**Età dichiarata:** ${arresto.eta}\n**Sesso:** ${troncaTesto(arresto.sesso, 100)}\n**Cittadinanza:** ${troncaTesto(arresto.cittadinanza, 150)}\n**Città di residenza:** ${troncaTesto(arresto.cittaResidenza, 200)}\n**Numero di telefono / Roblox:** ${troncaTesto(arresto.numeroTelefono, 250)}\n**Utente Discord:** <@${arresto.userId}>`,
        inline: false
      },
      {
        name: "Informazioni sull’arresto",
        value: `**Data dell’accaduto:** ${troncaTesto(arresto.data, 100)}\n**Reati:** ${troncaTesto(arresto.reati, 500)}\n**Descrizione:** ${troncaTesto(arresto.descrizioneAccaduto, 650)}`,
        inline: false
      },
      {
        name: "Dati dell’agente",
        value: `**Firma:** ${troncaTesto(arresto.firmaAgente, 300)}\n**ID arresto:** \`${arresto.id}\`\n**Registrato il:** ${formattaDataOra(arresto.registratoIl)}`,
        inline: false
      }
    )
    .setFooter({ text: "MPRP • Fedina penale" })
    .setTimestamp(new Date(arresto.registratoIl));
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PULSANTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function creaPulsantiApprovazione(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`documento_accetta:${userId}`).setLabel("Accetta").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`documento_rifiuta:${userId}`).setLabel("Rifiuta").setEmoji("❌").setStyle(ButtonStyle.Danger)
  );
}

function creaPulsantiApprovazioneDisabilitati(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`documento_accetta:${userId}`).setLabel("Accetta").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(`documento_rifiuta:${userId}`).setLabel("Rifiuta").setEmoji("❌").setStyle(ButtonStyle.Danger).setDisabled(true)
  );
}

function pulsantiPaginaDocumento(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`portafoglio_documento:${userId}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`portafoglio_conto:${userId}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary)
  );
}

function pulsantiPaginaConto(userId, possiedePatente) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`portafoglio_documento:${userId}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${possiedePatente ? "portafoglio_patente" : "portafoglio_auto"}:${userId}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary)
  );
}

function pulsantiPaginaPatente(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`portafoglio_conto:${userId}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`portafoglio_auto:${userId}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary)
  );
}

function pulsantiPaginaAuto(userId, possiedePatente) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${possiedePatente ? "portafoglio_patente" : "portafoglio_conto"}:${userId}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`portafoglio_auto:${userId}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary).setDisabled(true)
  );
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SERVIZIO STAFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function ottieniServizioStaff(database, userId) {
  const servizio = database.servizioStaff[userId] ?? { totaleMs: 0, sessioneIniziataIl: null, inPausa: false };
  servizio.totaleMs = Math.max(0, Number(servizio.totaleMs) || 0);
  servizio.sessioneIniziataIl = Number.isFinite(Number(servizio.sessioneIniziataIl)) ? Number(servizio.sessioneIniziataIl) : null;
  servizio.inPausa = Boolean(servizio.inPausa);
  database.servizioStaff[userId] = servizio;
  return servizio;
}

function calcolaTotaleServizio(servizio, adesso = Date.now()) {
  const base = Math.max(0, Number(servizio?.totaleMs) || 0);
  if (servizio?.sessioneIniziataIl && !servizio.inPausa) return base + Math.max(0, adesso - Number(servizio.sessioneIniziataIl));
  return base;
}

function formattaServizio(ms) {
  const secondi = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  const giorni = Math.floor(secondi / 86400);
  const ore = Math.floor((secondi % 86400) / 3600);
  const minuti = Math.floor((secondi % 3600) / 60);
  const sec = secondi % 60;
  return `${giorni}g ${ore}h ${minuti}m ${sec}s`;
}

function creaPulsantiServizioStaff(userId, stato) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`servizio_avvia:${userId}`).setLabel("Avvia servizio staff").setEmoji("🟢").setStyle(ButtonStyle.Success).setDisabled(stato === "attivo"),
    new ButtonBuilder().setCustomId(`servizio_pausa:${userId}`).setLabel("Ferma / break staff").setEmoji("⏸️").setStyle(ButtonStyle.Secondary).setDisabled(stato !== "attivo"),
    new ButtonBuilder().setCustomId(`servizio_fine:${userId}`).setLabel("Fine servizio staff").setEmoji("🔴").setStyle(ButtonStyle.Danger).setDisabled(stato === "nessun servizio")
  );
}

function creaEmbedServizioStaff(userId, nome, servizio) {
  const adesso = Date.now();
  const totale = calcolaTotaleServizio(servizio, adesso);
  const stato = servizio.sessioneIniziataIl && !servizio.inPausa ? "🟢 In servizio" : servizio.inPausa ? "⏸️ In pausa" : "⚪ Non in servizio";
  return new EmbedBuilder()
    .setColor(servizio.sessioneIniziataIl && !servizio.inPausa ? COLORI.verde : servizio.inPausa ? COLORI.giallo : COLORI.grigio)
    .setTitle("🛡️ Servizio Staff")
    .setDescription(`**${nome}**\n${stato}`)
    .addFields(
      { name: "Tempo totale", value: `**${formattaServizio(totale)}**`, inline: false },
      { name: "Giorni", value: String(Math.floor(totale / 86400000)), inline: true },
      { name: "Ore", value: String(Math.floor(totale / 3600000)), inline: true },
      { name: "Secondi", value: String(Math.floor(totale / 1000)), inline: true }
    )
    .setFooter({ text: `Discord ID: ${userId}` })
    .setTimestamp();
}

async function comandoServizioStaff(interaction) {
  const database = caricaDatabase();
  const servizio = ottieniServizioStaff(database, interaction.user.id);
  salvaDatabase(database);
  const stato = servizio.sessioneIniziataIl && !servizio.inPausa ? "attivo" : servizio.inPausa ? "pausa" : "nessun servizio";
  await interaction.reply({
    embeds: [creaEmbedServizioStaff(interaction.user.id, interaction.member?.displayName || interaction.user.displayName || interaction.user.username, servizio)],
    components: [creaPulsantiServizioStaff(interaction.user.id, stato)],
    flags: MessageFlags.Ephemeral
  });
}

async function visualizzaServizioUtente(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const database = caricaDatabase();
  const servizio = ottieniServizioStaff(database, destinatario.id);
  salvaDatabase(database);
  const membro = await interaction.guild.members.fetch(destinatario.id).catch(() => null);
  const nome = membro?.displayName || destinatario.globalName || destinatario.username;
  await interaction.reply({ embeds: [creaEmbedServizioStaff(destinatario.id, nome, servizio)], flags: MessageFlags.Ephemeral });
}

async function creaLeaderboardServizio(interaction, pagina = 1) {
  const database = caricaDatabase();
  const entries = Object.entries(database.servizioStaff || {})
    .map(([userId, servizio]) => ({ userId, ms: calcolaTotaleServizio(servizio) }))
    .filter(entry => entry.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  const perPagina = 15;
  const totalePagine = Math.max(1, Math.min(2, Math.ceil(entries.length / perPagina)));
  const paginaSicura = Math.max(1, Math.min(pagina, totalePagine));
  const inizio = (paginaSicura - 1) * perPagina;
  const paginaEntries = entries.slice(inizio, inizio + perPagina);
  const righe = paginaEntries.length
    ? paginaEntries.map((entry, indice) => `${inizio + indice + 1}. <@${entry.userId}> — **${formattaServizio(entry.ms)}**`).join("\n")
    : "Nessun servizio registrato.";

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.viola).setTitle("🏆 Leaderboard servizio staff").setDescription(righe).setFooter({ text: `Pagina ${paginaSicura}/${totalePagine} • Classifica fino a 30 posti` }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`servizio_leaderboard_indietro:${paginaSicura}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(paginaSicura <= 1),
      new ButtonBuilder().setCustomId(`servizio_leaderboard_avanti:${paginaSicura}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary).setDisabled(paginaSicura >= totalePagine)
    )],
    flags: MessageFlags.Ephemeral
  });
}

async function aggiornaLeaderboardServizio(interaction, pagina) {
  const database = caricaDatabase();
  const entries = Object.entries(database.servizioStaff || {})
    .map(([userId, servizio]) => ({ userId, ms: calcolaTotaleServizio(servizio) }))
    .filter(entry => entry.ms > 0)
    .sort((a, b) => b.ms - a.ms);
  const perPagina = 15;
  const totalePagine = Math.max(1, Math.min(2, Math.ceil(entries.length / perPagina)));
  const paginaSicura = Math.max(1, Math.min(pagina, totalePagine));
  const inizio = (paginaSicura - 1) * perPagina;
  const righe = entries.slice(inizio, inizio + perPagina).map((entry, indice) => `${inizio + indice + 1}. <@${entry.userId}> — **${formattaServizio(entry.ms)}**`).join("\n") || "Nessun servizio registrato.";
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(COLORI.viola).setTitle("🏆 Leaderboard servizio staff").setDescription(righe).setFooter({ text: `Pagina ${paginaSicura}/${totalePagine} • Classifica fino a 30 posti` }).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`servizio_leaderboard_indietro:${paginaSicura}`).setLabel("Indietro").setEmoji("⬅️").setStyle(ButtonStyle.Secondary).setDisabled(paginaSicura <= 1),
      new ButtonBuilder().setCustomId(`servizio_leaderboard_avanti:${paginaSicura}`).setLabel("Avanti").setEmoji("➡️").setStyle(ButtonStyle.Primary).setDisabled(paginaSicura >= totalePagine)
    )]
  });
}

async function gestisciAzioneServizio(interaction, azione, userId) {
  const membro = await ottieniMembroInterazione(interaction);
  if (!membro || !eStaff(membro)) {
    await interaction.reply({ content: "❌ Devi essere staff per gestire il servizio.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: "❌ Questi pulsanti appartengono a un altro operatore.", flags: MessageFlags.Ephemeral });
    return;
  }
  const database = caricaDatabase();
  const servizio = ottieniServizioStaff(database, userId);
  const adesso = Date.now();

  if (azione === "avvia") {
    if (servizio.sessioneIniziataIl && !servizio.inPausa) {
      await interaction.reply({ content: "⚠️ Il servizio è già attivo.", flags: MessageFlags.Ephemeral });
      return;
    }
    servizio.sessioneIniziataIl = adesso;
    servizio.inPausa = false;
  } else if (azione === "pausa") {
    if (!servizio.sessioneIniziataIl || servizio.inPausa) {
      await interaction.reply({ content: "⚠️ Il servizio non è attualmente attivo.", flags: MessageFlags.Ephemeral });
      return;
    }
    servizio.totaleMs = calcolaTotaleServizio(servizio, adesso);
    servizio.sessioneIniziataIl = null;
    servizio.inPausa = true;
  } else if (azione === "fine") {
    servizio.totaleMs = calcolaTotaleServizio(servizio, adesso);
    servizio.sessioneIniziataIl = null;
    servizio.inPausa = false;
  }

  database.servizioStaff[userId] = servizio;
  salvaDatabase(database);
  const stato = servizio.sessioneIniziataIl && !servizio.inPausa ? "attivo" : servizio.inPausa ? "pausa" : "nessun servizio";
  await interaction.update({
    embeds: [creaEmbedServizioStaff(userId, interaction.member?.displayName || interaction.user.displayName || interaction.user.username, servizio)],
    components: [creaPulsantiServizioStaff(userId, stato)]
  });
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMANDI SLASH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const comandi = [
  new SlashCommandBuilder()
    .setName("registra-documento").setDescription("Non disponibile")
    .addStringOption(o => o.setName("nome").setDescription("Nome").setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome").setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName("data-di-nascita").setDescription("GG-MM-AAAA").setRequired(true).setMinLength(10).setMaxLength(10))
    .addStringOption(o => o.setName("cittadinanza").setDescription("Cittadinanza").setRequired(true).setAutocomplete(true).setMaxLength(50))
    .addStringOption(o => o.setName("nome-roblox").setDescription("Nome Roblox").setRequired(true).setMaxLength(30)),

  new SlashCommandBuilder()
    .setName("registra-patente").setDescription("Registra la patente")
    .addStringOption(o => o.setName("nome").setDescription("Nome").setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome").setRequired(true).setMaxLength(30)),

  new SlashCommandBuilder().setName("portafoglio").setDescription("Visualizza il portafoglio"),

  new SlashCommandBuilder().setName("passa-documento").setDescription("Mostra il documento tramite DM")
    .addUserOption(o => o.setName("utente").setDescription("Destinatario").setRequired(true)),

  new SlashCommandBuilder().setName("passa-patente").setDescription("Mostra la patente tramite DM")
    .addUserOption(o => o.setName("utente").setDescription("Destinatario").setRequired(true)),

  new SlashCommandBuilder().setName("paga").setDescription("Paga in contanti")
    .addUserOption(o => o.setName("utente").setDescription("Destinatario").setRequired(true))
    .addIntegerOption(o => o.setName("importo").setDescription("Importo").setRequired(true).setMinValue(1).setMaxValue(100000000))
    .addStringOption(o => o.setName("causale").setDescription("Causale").setRequired(true).setMaxLength(300)),

  new SlashCommandBuilder().setName("bonifico").setDescription("Effettua un bonifico")
    .addUserOption(o => o.setName("utente").setDescription("Destinatario").setRequired(true))
    .addIntegerOption(o => o.setName("importo").setDescription("Importo").setRequired(true).setMinValue(1).setMaxValue(100000000))
    .addStringOption(o => o.setName("causale").setDescription("Causale").setRequired(true).setMaxLength(300)),

  new SlashCommandBuilder().setName("preleva").setDescription("Preleva soldi dalla banca")
    .addIntegerOption(o => o.setName("importo").setDescription("Importo da prelevare").setRequired(true).setMinValue(1).setMaxValue(100000000)),

  new SlashCommandBuilder().setName("deposita").setDescription("Deposita i contanti in banca")
    .addIntegerOption(o => o.setName("importo").setDescription("Importo da depositare").setRequired(true).setMinValue(1).setMaxValue(100000000)),

  new SlashCommandBuilder().setName("rimuovi-documento").setDescription("Rimuove il documento di un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente").setRequired(true)),

  new SlashCommandBuilder().setName("rimuovi-patente").setDescription("Rimuove la patente di un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente").setRequired(true)),

  new SlashCommandBuilder().setName("decreta-punti-patente").setDescription("Toglie punti dalla patente")
    .addUserOption(o => o.setName("utente").setDescription("Utente").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome esatto sul documento").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome esatto sul documento").setRequired(true).setMaxLength(50))
    .addIntegerOption(o => o.setName("punti").setDescription("Punti da togliere").setRequired(true).setMinValue(1).setMaxValue(20)),

  new SlashCommandBuilder().setName("sequestro-patente").setDescription("Sequestra temporaneamente una patente")
    .addUserOption(o => o.setName("utente").setDescription("Utente").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome esatto sul documento").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome esatto sul documento").setRequired(true).setMaxLength(50))
    .addIntegerOption(o => o.setName("durata").setDescription("Durata").setRequired(true).setMinValue(1).setMaxValue(365))
    .addStringOption(o => o.setName("unita").setDescription("Unità di tempo").setRequired(true).addChoices(
      { name: "Minuti", value: "minuti" }, { name: "Ore", value: "ore" }, { name: "Giorni", value: "giorni" }
    )),

  new SlashCommandBuilder().setName("multa").setDescription("Registra una multa a un cittadino")
    .addUserOption(o => o.setName("utente").setDescription("Utente multato").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome del multato").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome del multato").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("reato").setDescription("Articolo o reato contestato").setRequired(true).setMaxLength(500))
    .addIntegerOption(o => o.setName("importo").setDescription("Importo della multa").setRequired(true).setMinValue(1).setMaxValue(100000000))
    .addStringOption(o => o.setName("descrizione").setDescription("Descrizione dell’accaduto").setRequired(true).setMaxLength(1000))
    .addStringOption(o => o.setName("agente").setDescription("Nome o firma dell’agente").setRequired(true).setMaxLength(200)),

  new SlashCommandBuilder().setName("paga-multa").setDescription("Paga una tua multa dal conto bancario")
    .addUserOption(o => o.setName("utente").setDescription("Devi selezionare te stesso").setRequired(true))
    .addStringOption(o => o.setName("id-multa").setDescription("ID della multa").setRequired(true).setMaxLength(30)),

  new SlashCommandBuilder().setName("controllo-multe").setDescription("Visualizza le multe di un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente da controllare").setRequired(true)),

  new SlashCommandBuilder().setName("rimuovi-multa").setDescription("Elimina una multa dal database")
    .addUserOption(o => o.setName("utente").setDescription("Proprietario della multa").setRequired(true))
    .addStringOption(o => o.setName("id-multa").setDescription("ID della multa").setRequired(true).setMaxLength(30)),

  new SlashCommandBuilder().setName("registra-arresto").setDescription("Registra un arresto nella fedina penale")
    .addUserOption(o => o.setName("utente-arrestato").setDescription("Utente Discord arrestato").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome esatto sul documento").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome esatto sul documento").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("data-nascita").setDescription("Data di nascita esatta, GG-MM-AAAA").setRequired(true).setMaxLength(20))
    .addStringOption(o => o.setName("cittadinanza").setDescription("Cittadinanza esatta sul documento").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("sesso").setDescription("Sesso").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("citta-residenza").setDescription("Città di residenza").setRequired(true).setMaxLength(100))
    .addIntegerOption(o => o.setName("eta").setDescription("Età esatta calcolata dal documento").setRequired(true).setMinValue(0).setMaxValue(150))
    .addStringOption(o => o.setName("numero-telefono").setDescription("Numero di telefono").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("reati").setDescription("Reati contestati").setRequired(true).setMaxLength(1000))
    .addStringOption(o => o.setName("descrizione-accaduto").setDescription("Descrizione dell’accaduto").setRequired(true).setMaxLength(1000))
    .addStringOption(o => o.setName("firma-agente").setDescription("Firma o nome dell’agente").setRequired(true).setMaxLength(200)),

  new SlashCommandBuilder().setName("controlla-fedina-penale").setDescription("Visualizza la fedina penale di un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente da controllare").setRequired(true)),

  new SlashCommandBuilder().setName("rimuovi-arrestato").setDescription("Rimuove un arresto dalla fedina penale")
    .addUserOption(o => o.setName("utente").setDescription("Utente arrestato").setRequired(true))
    .addStringOption(o => o.setName("id-arresto").setDescription("ID dell’arresto").setRequired(true).setMaxLength(30)),

  new SlashCommandBuilder().setName("aggiungi-punti-patente").setDescription("Aggiunge punti alla patente di un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome esatto sul documento").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome esatto sul documento").setRequired(true).setMaxLength(50))
    .addIntegerOption(o => o.setName("punti").setDescription("Punti da aggiungere").setRequired(true).setMinValue(1).setMaxValue(20)),

  new SlashCommandBuilder().setName("immatricola-auto").setDescription("Immatricola un veicolo a un cittadino")
    .addUserOption(o => o.setName("utente").setDescription("Intestatario").setRequired(true))
    .addStringOption(o => o.setName("nome").setDescription("Nome intestatario").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cognome").setDescription("Cognome intestatario").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("modello").setDescription("Modello del veicolo").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("targa").setDescription("Targa del veicolo").setRequired(true).setMaxLength(20))
    .addStringOption(o => o.setName("colore").setDescription("Colore del veicolo").setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName("cerchioni").setDescription("Tipo o colore dei cerchioni").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("gancio").setDescription("Presenza del gancio").setRequired(true).addChoices(
      { name: "Presente", value: "presente" }, { name: "Non presente", value: "non-presente" }
    )),

  new SlashCommandBuilder().setName("controlla-targa").setDescription("Controlla i dati di una targa")
    .addStringOption(o => o.setName("targa").setDescription("Targa da controllare").setRequired(true).setMaxLength(20)),

  new SlashCommandBuilder().setName("assicurazione").setDescription("Acquista o rinnova l’assicurazione di un tuo veicolo")
    .addStringOption(o => o.setName("targa").setDescription("Targa del tuo veicolo").setRequired(true).setMaxLength(20)),

  new SlashCommandBuilder().setName("embed").setDescription("Invia un embed in un canale")
    .addStringOption(o => o.setName("colore").setDescription("Colore: nome, HEX o #HEX").setRequired(true).setMaxLength(30))
    .addChannelOption(o => o.setName("canale").setDescription("Canale in cui inviare l’embed").setRequired(true))
    .addStringOption(o => o.setName("messaggio").setDescription("Testo dell’embed").setRequired(true).setMaxLength(4000))
    .addAttachmentOption(o => o.setName("immagine-iniziale").setDescription("Immagine piccola in alto a destra (opzionale)").setRequired(false))
    .addAttachmentOption(o => o.setName("immagine").setDescription("Immagine grande sotto il messaggio (opzionale)").setRequired(false)),

  new SlashCommandBuilder().setName("portale").setDescription("Apre il login del portale MPRP"),

  new SlashCommandBuilder().setName("reset-auto").setDescription("Rimuove tutti i veicoli immatricolati a un utente")
    .addUserOption(o => o.setName("utente").setDescription("Utente da resettare").setRequired(true)),

  new SlashCommandBuilder().setName("servizio").setDescription("Gestione del servizio staff")
    .addSubcommand(sub => sub.setName("staff").setDescription("Visualizza e gestisci il tuo servizio staff"))
    .addSubcommand(sub => sub.setName("nome").setDescription("Visualizza il servizio di un utente").addUserOption(o => o.setName("utente").setDescription("Utente da controllare").setRequired(true)))
    .addSubcommand(sub => sub.setName("leadbord").setDescription("Mostra la classifica del servizio staff")),

].map(comando => comando.toJSON());

async function registraComandi() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: comandi });
  console.log("✅ Comandi registrati.");
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUTOCOMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function gestisciAutocomplete(interaction) {
  const opzione = interaction.options.getFocused(true);
  if (opzione.name !== "cittadinanza") return;
  const ricerca = String(opzione.value).toLowerCase();
  const risultati = NAZIONALITA
    .filter(n => n.toLowerCase().includes(ricerca))
    .slice(0, 25)
    .map(n => ({ name: n, value: n }));
  await interaction.respond(risultati);
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RICHIESTA CITTADINANZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function creaPulsanteRichiestaCittadinanza() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("apri_richiesta_cittadinanza")
      .setLabel("Richiedi cittadinanza")
      .setEmoji("🪪")
      .setStyle(ButtonStyle.Primary)
  );
}

function creaModalRichiestaCittadinanza() {
  return new ModalBuilder()
    .setCustomId("modulo_richiesta_cittadinanza")
    .setTitle("Richiesta di cittadinanza")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Nome").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cognome").setLabel("Cognome").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("data-di-nascita").setLabel("Data di nascita (GG-MM-AAAA)").setStyle(TextInputStyle.Short).setRequired(true).setMinLength(10).setMaxLength(10)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cittadinanza").setLabel("Cittadinanza").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome-roblox").setLabel("Nome Roblox").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30))
    );
}

async function inviaRichiestaDocumento(interaction, dati) {
  const database = caricaDatabase();
  const userId = interaction.user.id;

  if (database.utenti[userId]?.documento) {
    await interaction.reply({ content: "❌ Possiedi già un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (database.richiesteDocumenti[userId]) {
    await interaction.reply({ content: "⏳ Hai già una richiesta in attesa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const nome = String(dati.nome || "").trim();
  const cognome = String(dati.cognome || "").trim();
  const dataNascita = String(dati.dataNascita || "").trim();
  const cittadinanza = String(dati.cittadinanza || "").trim();
  const nomeRoblox = String(dati.nomeRoblox || "").trim();

  if (!nome || !cognome || !cittadinanza || !nomeRoblox || calcolaEta(dataNascita) === null) {
    await interaction.reply({ content: "❌ Dati non validi. Controlla tutti i campi e usa la data GG-MM-AAAA.", flags: MessageFlags.Ephemeral });
    return;
  }

  const documento = {
    discordId: userId, nome, cognome, dataNascita, cittadinanza, nomeRoblox,
    richiestoIl: new Date().toISOString()
  };

  database.richiesteDocumenti[userId] = documento;
  salvaDatabase(database);

  try {
    const canale = await client.channels.fetch(CANALE_DOCUMENTI);
    if (!canale?.isTextBased()) throw new Error("Canale documenti non valido");
    await canale.send({
      embeds: [creaEmbedDocumento(documento, "📨 Nuova richiesta documento")
        .setDescription(`Richiesta inviata da ${interaction.user}\nID Discord: \`${userId}\``)
        .setColor(COLORI.giallo)],
      components: [creaPulsantiApprovazione(userId)]
    });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("✅ Richiesta inviata").setDescription("Il documento è in attesa di approvazione.")],
      flags: MessageFlags.Ephemeral
    });
  } catch (errore) {
    const aggiornato = caricaDatabase();
    delete aggiornato.richiesteDocumenti[userId];
    salvaDatabase(aggiornato);
    console.error("❌ Errore invio richiesta documento:", errore);
    await interaction.reply({ content: "❌ Errore durante l’invio della richiesta.", flags: MessageFlags.Ephemeral });
  }
}

async function inviaPannelloCittadinanza() {
  const statoDatabase = caricaDatabase();
  if (statoDatabase.pannelloCittadinanzaInviatoIl) {
    console.log("ℹ️ Pannello cittadinanza già presente: non invio un duplicato.");
    return;
  }

  try {
    const canale = await client.channels.fetch(CANALE_RICHIESTE_CITTADINANZA);
    if (!canale?.isTextBased()) throw new Error("Canale cittadinanza non valido");

    const embed = new EmbedBuilder()
      .setColor(COLORI.blu)
      .setTitle("🇺🇸 Richiesta di cittadinanza")
      .setDescription("Compila il modulo per richiedere la cittadinanza. Dopo l’invio la richiesta verrà inoltrata per l’approvazione.")
      .setFooter({ text: "MPRP • Ufficio cittadinanza" })
      .setTimestamp();

    await canale.send({ embeds: [embed], components: [creaPulsanteRichiestaCittadinanza()] });
    const database = caricaDatabase();
    database.pannelloCittadinanzaInviatoIl = new Date().toISOString();
    salvaDatabase(database);
    console.log(`✅ Pannello cittadinanza inviato nel canale ${CANALE_RICHIESTE_CITTADINANZA}.`);
  } catch (errore) {
    console.error("❌ Non sono riuscito a inviare il pannello cittadinanza:", errore);
  }
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DOCUMENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function registraDocumento(interaction) {
  await inviaRichiestaDocumento(interaction, {
    nome: interaction.options.getString("nome", true),
    cognome: interaction.options.getString("cognome", true),
    dataNascita: interaction.options.getString("data-di-nascita", true),
    cittadinanza: interaction.options.getString("cittadinanza", true),
    nomeRoblox: interaction.options.getString("nome-roblox", true)
  });
}

async function accettaDocumento(interaction, userId) {
  if (!await puoGestireRichiesteDocumento(interaction)) {
    await interaction.reply({ content: "❌ Non hai il permesso di accettare documenti.", flags: MessageFlags.Ephemeral });
    return;
  }

  const database = caricaDatabase();
  const richiesta = database.richiesteDocumenti[userId];
  if (!richiesta) {
    await interaction.reply({ content: "❌ Richiesta già gestita.", flags: MessageFlags.Ephemeral });
    return;
  }

  const utente = database.utenti[userId] ?? creaUtenteVuoto(userId);
  preparaDatiUtente(utente, userId);
  utente.documento = { ...richiesta, approvatoIl: new Date().toISOString() };
  database.utenti[userId] = utente;
  delete database.richiesteDocumenti[userId];
  salvaDatabase(database);

  await trasformaInCittadino(interaction.guild, userId);
  await interaction.update({
    embeds: [creaEmbedDocumento(richiesta, "✅ Documento accettato").setColor(COLORI.verde).setDescription(`Accettato da ${interaction.user}.`)],
    components: [creaPulsantiApprovazioneDisabilitati(userId)]
  });

  try {
    const utenteDiscord = await client.users.fetch(userId);
    await utenteDiscord.send({
      embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("✅ Documento accettato")
        .setDescription("Il documento è stato accettato. Hai ricevuto il ruolo Cittadino e ora puoi usare `/portafoglio`.")]
    });
  } catch {}
}

async function rifiutaDocumento(interaction, userId) {
  if (!await puoGestireRichiesteDocumento(interaction)) {
    await interaction.reply({ content: "❌ Non hai il permesso di rifiutare documenti.", flags: MessageFlags.Ephemeral });
    return;
  }

  const database = caricaDatabase();
  const richiesta = database.richiesteDocumenti[userId];
  if (!richiesta) {
    await interaction.reply({ content: "❌ Richiesta già gestita.", flags: MessageFlags.Ephemeral });
    return;
  }

  delete database.richiesteDocumenti[userId];
  salvaDatabase(database);
  await interaction.update({
    embeds: [creaEmbedDocumento(richiesta, "❌ Documento rifiutato").setColor(COLORI.rosso).setDescription(`Rifiutato da ${interaction.user}.`)],
    components: [creaPulsantiApprovazioneDisabilitati(userId)]
  });

  try {
    const utenteDiscord = await client.users.fetch(userId);
    await utenteDiscord.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("❌ Documento rifiutato").setDescription("Puoi correggere i dati e inviare una nuova richiesta.")] });
  } catch {}
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PATENTE E PORTAFOGLIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function registraPatente(interaction) {
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Devi avere un documento approvato.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (utente.patente) {
    await interaction.reply({ content: "❌ Possiedi già una patente.", flags: MessageFlags.Ephemeral });
    return;
  }

  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  if (nome.toLowerCase() !== utente.documento.nome.toLowerCase() || cognome.toLowerCase() !== utente.documento.cognome.toLowerCase()) {
    await interaction.reply({ content: "❌ Nome e cognome non corrispondono al documento.", flags: MessageFlags.Ephemeral });
    return;
  }

  const patente = {
    nome,
    cognome,
    punti: 20,
    registrataIl: new Date().toISOString(),
    sequestrataIl: null,
    sequestrataFinoAl: null
  };

  aggiornaUtente(interaction.user.id, dati => {
    dati.patente = patente;
    return dati;
  });
  creaBackupDatabase("patente");

  try {
    const canale = await client.channels.fetch(CANALE_LOG_PATENTI);
    if (canale?.isTextBased()) {
      await canale.send({ embeds: [creaEmbedPatente(patente).setTitle("🚗 Nuova patente registrata").setDescription(`${interaction.user} ha registrato una patente.`)] });
    }
  } catch {}

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("✅ Patente registrata").setDescription("La patente è stata aggiunta al portafoglio.")],
    flags: MessageFlags.Ephemeral
  });
}

async function mostraPortafoglio(interaction) {
  controllaSequestroScaduto(interaction.user.id);
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Non possiedi un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    embeds: [creaEmbedPortafoglioDocumento(utente.documento)],
    components: [pulsantiPaginaDocumento(interaction.user.id)],
    flags: MessageFlags.Ephemeral
  });
}

async function verificaProprietario(interaction, proprietarioId) {
  if (interaction.user.id === proprietarioId) return true;
  await interaction.reply({ content: "❌ Questo portafoglio non appartiene a te.", flags: MessageFlags.Ephemeral });
  return false;
}

async function paginaDocumento(interaction, proprietarioId) {
  if (!await verificaProprietario(interaction, proprietarioId)) return;
  const utente = ottieniUtente(proprietarioId);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Documento non disponibile.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({ embeds: [creaEmbedPortafoglioDocumento(utente.documento)], components: [pulsantiPaginaDocumento(proprietarioId)] });
}

async function paginaConto(interaction, proprietarioId) {
  if (!await verificaProprietario(interaction, proprietarioId)) return;
  const utente = ottieniUtente(proprietarioId);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Documento non disponibile.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({ embeds: [creaEmbedPortafoglioConto(utente.documento, utente.conto)], components: [pulsantiPaginaConto(proprietarioId, Boolean(utente.patente))] });
}

async function paginaPatente(interaction, proprietarioId) {
  if (!await verificaProprietario(interaction, proprietarioId)) return;
  controllaSequestroScaduto(proprietarioId);
  const utente = ottieniUtente(proprietarioId);
  if (!utente.patente) {
    await interaction.reply({ content: "❌ Non possiedi una patente.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({ embeds: [creaEmbedPortafoglioPatente(utente.patente)], components: [pulsantiPaginaPatente(proprietarioId)] });
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ECONOMIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function paginaAuto(interaction, proprietarioId) {
  if (!await verificaProprietario(interaction, proprietarioId)) return;
  const database = caricaDatabase();
  const utente = database.utenti[proprietarioId];
  if (!utente?.documento) {
    await interaction.reply({ content: "❌ Documento non disponibile.", flags: MessageFlags.Ephemeral });
    return;
  }
  preparaDatiUtente(utente, proprietarioId);
  const veicoli = utente.auto.map(targa => database.targhe[targa]).filter(Boolean);
  await interaction.update({
    embeds: [creaEmbedPortafoglioAuto(utente.documento, veicoli)],
    components: [pulsantiPaginaAuto(proprietarioId, Boolean(utente.patente))]
  });
}

async function prelevaDenaro(interaction) {
  const importo = interaction.options.getInteger("importo", true);
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Devi avere un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (utente.conto.banca < importo) {
    await interaction.reply({ content: `❌ Saldo insufficiente. In banca hai **${formattaSoldi(utente.conto.banca)}**.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const aggiornato = aggiornaUtente(interaction.user.id, dati => {
    dati.conto.banca -= importo;
    dati.conto.contanti += importo;
    return dati;
  });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("🏧 Prelievo effettuato").setDescription(`Hai prelevato **${formattaSoldi(importo)}**.`)
      .addFields({ name: "Banca", value: formattaSoldi(aggiornato.conto.banca), inline: true }, { name: "Contanti", value: formattaSoldi(aggiornato.conto.contanti), inline: true })],
    flags: MessageFlags.Ephemeral
  });
}

async function depositaDenaro(interaction) {
  const importo = interaction.options.getInteger("importo", true);
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Devi avere un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (utente.conto.contanti < importo) {
    await interaction.reply({ content: `❌ Contanti insufficienti. Possiedi **${formattaSoldi(utente.conto.contanti)}**.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const aggiornato = aggiornaUtente(interaction.user.id, dati => {
    dati.conto.contanti -= importo;
    dati.conto.banca += importo;
    return dati;
  });

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("🏦 Deposito effettuato").setDescription(`Hai depositato **${formattaSoldi(importo)}**.`)
      .addFields({ name: "Banca", value: formattaSoldi(aggiornato.conto.banca), inline: true }, { name: "Contanti", value: formattaSoldi(aggiornato.conto.contanti), inline: true })],
    flags: MessageFlags.Ephemeral
  });
}

function trasferisciDenaro(mittenteId, destinatarioId, tipo, importo) {
  const database = caricaDatabase();
  database.utenti[mittenteId] ??= creaUtenteVuoto(mittenteId);
  database.utenti[destinatarioId] ??= creaUtenteVuoto(destinatarioId);
  preparaDatiUtente(database.utenti[mittenteId], mittenteId);
  preparaDatiUtente(database.utenti[destinatarioId], destinatarioId);

  database.utenti[mittenteId].conto[tipo] -= importo;
  database.utenti[destinatarioId].conto[tipo] += importo;
  salvaDatabase(database);
}

async function pagaContanti(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const importo = interaction.options.getInteger("importo", true);
  const causale = interaction.options.getString("causale", true).trim();

  if (destinatario.bot || destinatario.id === interaction.user.id) {
    await interaction.reply({ content: "❌ Destinatario non valido.", flags: MessageFlags.Ephemeral });
    return;
  }

  const mittente = ottieniUtente(interaction.user.id);
  const ricevente = ottieniUtente(destinatario.id);
  if (!mittente.documento || !ricevente.documento) {
    await interaction.reply({ content: "❌ Entrambi gli utenti devono avere un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (mittente.conto.contanti < importo) {
    await interaction.reply({ content: "❌ Contanti insufficienti.", flags: MessageFlags.Ephemeral });
    return;
  }

  trasferisciDenaro(interaction.user.id, destinatario.id, "contanti", importo);
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("💵 Pagamento effettuato").setDescription(`Hai pagato **${formattaSoldi(importo)}** a ${destinatario}.`).addFields({ name: "Causale", value: causale })],
    flags: MessageFlags.Ephemeral
  });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("💵 Pagamento ricevuto").setDescription(`Hai ricevuto **${formattaSoldi(importo)}** in contanti da ${interaction.user}.`).addFields({ name: "Causale", value: causale })] });
  } catch {}
}

async function effettuaBonifico(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const importo = interaction.options.getInteger("importo", true);
  const causale = interaction.options.getString("causale", true).trim();

  if (destinatario.bot || destinatario.id === interaction.user.id) {
    await interaction.reply({ content: "❌ Destinatario non valido.", flags: MessageFlags.Ephemeral });
    return;
  }

  const mittente = ottieniUtente(interaction.user.id);
  const ricevente = ottieniUtente(destinatario.id);
  if (!mittente.documento || !ricevente.documento) {
    await interaction.reply({ content: "❌ Entrambi gli utenti devono avere un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (mittente.conto.banca < importo) {
    await interaction.reply({ content: "❌ Saldo bancario insufficiente.", flags: MessageFlags.Ephemeral });
    return;
  }

  trasferisciDenaro(interaction.user.id, destinatario.id, "banca", importo);
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("🏦 Bonifico effettuato").setDescription(`Hai inviato **${formattaSoldi(importo)}** a ${destinatario}.`).addFields({ name: "Causale", value: causale })],
    flags: MessageFlags.Ephemeral
  });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("🏦 Bonifico ricevuto").setDescription(`Hai ricevuto **${formattaSoldi(importo)}** da ${interaction.user}.`).addFields({ name: "Causale", value: causale })] });
  } catch {}

  try {
    const canale = await client.channels.fetch(CANALE_LOG_BONIFICI);
    if (canale?.isTextBased()) {
      await canale.send({
        embeds: [new EmbedBuilder().setColor(COLORI.blu).setTitle("🏦 Nuovo bonifico")
          .setDescription(`${interaction.user} ha inviato un bonifico a ${destinatario}.`)
          .addFields({ name: "Importo", value: formattaSoldi(importo), inline: true }, { name: "Causale", value: causale, inline: false })
          .setTimestamp()]
      });
    }
  } catch {}
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PASSA DOCUMENTO E PATENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function passaDocumento(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ Non possiedi un documento.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (destinatario.bot || destinatario.id === interaction.user.id) {
    await interaction.reply({ content: "❌ Destinatario non valido.", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await destinatario.send({ embeds: [creaEmbedDocumento(utente.documento, "🪪 Documento mostrato").setDescription(`${interaction.user} ti ha mostrato il suo documento.`)] });
    await interaction.reply({ content: "✅ Documento inviato.", flags: MessageFlags.Ephemeral });
  } catch {
    await interaction.reply({ content: "❌ Impossibile inviare il DM.", flags: MessageFlags.Ephemeral });
  }
}

async function passaPatente(interaction) {
  controllaSequestroScaduto(interaction.user.id);
  const destinatario = interaction.options.getUser("utente", true);
  const utente = ottieniUtente(interaction.user.id);
  if (!utente.patente) {
    await interaction.reply({ content: "❌ Non possiedi una patente.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (patenteSequestrata(utente.patente)) {
    await interaction.reply({ content: `❌ La patente è sequestrata fino al **${formattaDataOra(utente.patente.sequestrataFinoAl)}**.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (destinatario.bot || destinatario.id === interaction.user.id) {
    await interaction.reply({ content: "❌ Destinatario non valido.", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await destinatario.send({ embeds: [creaEmbedPatente(utente.patente).setDescription(`${interaction.user} ti ha mostrato la sua patente.`)] });
    await interaction.reply({ content: "✅ Patente inviata.", flags: MessageFlags.Ephemeral });
  } catch {
    await interaction.reply({ content: "❌ Impossibile inviare il DM.", flags: MessageFlags.Ephemeral });
  }
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RIMOZIONI, PUNTI E SEQUESTRO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function rimuoviDocumento(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const utente = ottieniUtente(destinatario.id);
  if (!utente.documento) {
    await interaction.reply({ content: "❌ L’utente non possiede un documento.", flags: MessageFlags.Ephemeral });
    return;
  }

  aggiornaUtente(destinatario.id, dati => {
    dati.documento = null;
    return dati;
  });

  await interaction.reply({ content: "✅ Documento rimosso. La patente è rimasta.", flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("🗑️ Documento rimosso").setDescription("Il documento è stato rimosso. La patente non è stata rimossa.")] });
  } catch {}
}

async function rimuoviPatente(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const utente = ottieniUtente(destinatario.id);
  if (!utente.patente) {
    await interaction.reply({ content: "❌ L’utente non possiede una patente.", flags: MessageFlags.Ephemeral });
    return;
  }

  const timer = timerSequestri.get(destinatario.id);
  if (timer) clearTimeout(timer);
  timerSequestri.delete(destinatario.id);
  aggiornaUtente(destinatario.id, dati => {
    dati.patente = null;
    return dati;
  });

  await interaction.reply({ content: "✅ Patente rimossa.", flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("🗑️ Patente rimossa")] });
  } catch {}
}

async function decretaPuntiPatente(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const punti = interaction.options.getInteger("punti", true);
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }
  const utente = controllo.utente;
  if (!utente.patente) {
    await interaction.reply({ content: "❌ L’utente non possiede una patente.", flags: MessageFlags.Ephemeral });
    return;
  }

  const precedenti = utente.patente.punti;
  const nuovi = Math.max(0, precedenti - punti);
  const rimossi = precedenti - nuovi;
  aggiornaUtente(destinatario.id, dati => {
    dati.patente.punti = nuovi;
    return dati;
  });

  await interaction.reply({ content: `✅ Rimossi ${rimossi} punti. Punti attuali: ${nuovi}/20.`, flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("📉 Punti patente decurtati").setDescription(`Ti sono stati tolti **${rimossi} punti**. Ora possiedi **${nuovi}/20** punti.`)] });
  } catch {}
}

async function sequestraPatente(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const durata = interaction.options.getInteger("durata", true);
  const unita = interaction.options.getString("unita", true);
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }
  const utente = controllo.utente;
  if (!utente.patente) {
    await interaction.reply({ content: "❌ L’utente non possiede una patente.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (patenteSequestrata(utente.patente)) {
    await interaction.reply({ content: "❌ La patente è già sequestrata.", flags: MessageFlags.Ephemeral });
    return;
  }

  const millisecondi = convertiDurataInMillisecondi(durata, unita);
  if (!millisecondi) {
    await interaction.reply({ content: "❌ Durata non valida.", flags: MessageFlags.Ephemeral });
    return;
  }

  const adesso = Date.now();
  const scadenza = adesso + millisecondi;
  aggiornaUtente(destinatario.id, dati => {
    dati.patente.sequestrataIl = adesso;
    dati.patente.sequestrataFinoAl = scadenza;
    return dati;
  });
  programmaRestituzionePatente(destinatario.id, scadenza);

  const testoDurata = formattaDurata(durata, unita);
  await interaction.reply({ content: `✅ Patente sequestrata per ${testoDurata}.`, flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("🚫 Patente sequestrata").setDescription(`La patente è stata sequestrata per **${testoDurata}**.`).addFields({ name: "Restituzione", value: formattaDataOra(scadenza) })] });
  } catch {}
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MULTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function registraMulta(interaction) {
  if (!prenotaOperazioneUnica(`discord-multa:${interaction.id}`)) return;

  const destinatario = interaction.options.getUser("utente", true);
  if (destinatario.bot) {
    await interaction.reply({ content: "❌ Non puoi multare un bot.", flags: MessageFlags.Ephemeral });
    return;
  }

  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }

  const multa = {
    id: generaId("MUL"),
    userId: destinatario.id,
    nome: controllo.documento.nome,
    cognome: controllo.documento.cognome,
    reato: interaction.options.getString("reato", true).trim(),
    importo: interaction.options.getInteger("importo", true),
    descrizione: interaction.options.getString("descrizione", true).trim(),
    agente: interaction.options.getString("agente", true).trim(),
    agenteDiscordId: interaction.user.id,
    stato: "PENDENTE",
    creataIl: new Date().toISOString(),
    pagataIl: null
  };

  const database = caricaDatabase();
  database.utenti[destinatario.id] ??= creaUtenteVuoto(destinatario.id);
  preparaDatiUtente(database.utenti[destinatario.id], destinatario.id);
  database.multe[multa.id] = multa;
  database.utenti[destinatario.id].multe.push(multa.id);
  salvaDatabase(database);
  creaBackupDatabase("multa");

  await interaction.reply({ embeds: [creaEmbedMulta(multa, "✅ Multa registrata")], flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({
      content: `Hai ricevuto una multa. Per pagarla usa \`/paga-multa\` con ID \`${multa.id}\`.`,
      embeds: [creaEmbedMulta(multa)]
    });
  } catch {}
}

async function pagaMulta(interaction) {
  const utenteScelto = interaction.options.getUser("utente", true);
  const idMulta = interaction.options.getString("id-multa", true).trim().toUpperCase();

  if (utenteScelto.id !== interaction.user.id) {
    await interaction.reply({ content: "❌ Nel campo utente devi selezionare te stesso.", flags: MessageFlags.Ephemeral });
    return;
  }

  const database = caricaDatabase();
  const multa = database.multe[idMulta];
  if (!multa || multa.userId !== interaction.user.id) {
    await interaction.reply({ content: "❌ Multa non trovata o non appartenente a te.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (multa.stato === "PAGATA") {
    await interaction.reply({ content: "❌ Questa multa è già stata pagata.", flags: MessageFlags.Ephemeral });
    return;
  }

  database.utenti[interaction.user.id] ??= creaUtenteVuoto(interaction.user.id);
  preparaDatiUtente(database.utenti[interaction.user.id], interaction.user.id);
  const saldo = database.utenti[interaction.user.id].conto.banca;
  if (saldo < multa.importo) {
    await interaction.reply({
      content: `❌ Non hai abbastanza soldi in banca. Servono **${formattaSoldi(multa.importo)}**, ma possiedi **${formattaSoldi(saldo)}**.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  database.utenti[interaction.user.id].conto.banca -= multa.importo;
  multa.stato = "PAGATA";
  multa.pagataIl = new Date().toISOString();
  salvaDatabase(database);

  await interaction.reply({
    embeds: [creaEmbedMulta(multa, "✅ Multa pagata").addFields({ name: "Nuovo saldo bancario", value: formattaSoldi(database.utenti[interaction.user.id].conto.banca) })],
    flags: MessageFlags.Ephemeral
  });
}

async function controlloMulte(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const database = caricaDatabase();
  const ids = database.utenti[destinatario.id]?.multe ?? [];
  const multe = ids.map(id => database.multe[id]).filter(Boolean);

  if (!multe.length) {
    await interaction.reply({ content: `✅ ${destinatario} non ha multe registrate.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const testo = multe.map((multa, indice) =>
    `**${indice + 1}. ${multa.id}**\nReato: ${troncaTesto(multa.reato, 250)}\nImporto: ${formattaSoldi(multa.importo)}\nStato: ${multa.stato}\nData: ${formattaDataOra(multa.creataIl)}`
  ).join("\n\n");

  const blocchi = dividiInBlocchi(testo);
  await interaction.reply({
    embeds: blocchi.slice(0, 10).map((blocco, i) => new EmbedBuilder()
      .setColor(COLORI.blu)
      .setTitle(i === 0 ? `📋 Multe di ${destinatario.username}` : `📋 Multe — pagina ${i + 1}`)
      .setDescription(blocco)),
    flags: MessageFlags.Ephemeral
  });
}

async function rimuoviMulta(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const idMulta = interaction.options.getString("id-multa", true).trim().toUpperCase();
  const database = caricaDatabase();
  const multa = database.multe[idMulta];

  if (!multa || multa.userId !== destinatario.id) {
    await interaction.reply({ content: "❌ Multa non trovata per questo utente.", flags: MessageFlags.Ephemeral });
    return;
  }

  delete database.multe[idMulta];
  if (database.utenti[destinatario.id]) {
    database.utenti[destinatario.id].multe = database.utenti[destinatario.id].multe.filter(id => id !== idMulta);
  }
  salvaDatabase(database);

  await interaction.reply({ content: `✅ Multa \`${idMulta}\` rimossa dal database.`, flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.giallo).setTitle("🗑️ Multa rimossa").setDescription(`La multa con ID \`${idMulta}\` è stata rimossa dallo Staff.`)] });
  } catch {}
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PUNTI PATENTE E VEICOLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function aggiungiPuntiPatente(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const punti = interaction.options.getInteger("punti", true);
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }
  const utente = controllo.utente;
  if (!utente.patente) {
    await interaction.reply({ content: "❌ L’utente non possiede una patente.", flags: MessageFlags.Ephemeral });
    return;
  }
  const precedenti = utente.patente.punti;
  const nuovi = Math.min(20, precedenti + punti);
  const aggiunti = nuovi - precedenti;
  aggiornaUtente(destinatario.id, dati => { dati.patente.punti = nuovi; return dati; });
  await interaction.reply({ content: `✅ Aggiunti **${aggiunti} punti**. Punti attuali: **${nuovi}/20**.`, flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.verde).setTitle("📈 Punti patente aggiunti").setDescription(`Lo Staff ha aggiunto **${aggiunti} punti** alla tua patente. Ora possiedi **${nuovi}/20** punti.`).setTimestamp()] });
  } catch {}
}

function normalizzaTarga(targa) {
  return String(targa).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function creaEmbedVeicolo(veicolo, titolo = "🚘 Veicolo immatricolato") {
  const attiva = assicurazioneAttiva(veicolo);
  return new EmbedBuilder()
    .setColor(attiva ? COLORI.verde : COLORI.viola)
    .setTitle(titolo)
    .addFields(
      { name: "Intestatario", value: `${veicolo.nome} ${veicolo.cognome}
<@${veicolo.userId}>`, inline: false },
      { name: "Veicolo", value: `**Modello:** ${veicolo.modello}
**Targa:** \`${veicolo.targa}\`
**Colore:** ${veicolo.colore}`, inline: true },
      { name: "Allestimento", value: `**Cerchioni:** ${veicolo.cerchioni}
**Gancio:** ${veicolo.gancio ? "Presente" : "Non presente"}`, inline: true },
      { name: "Assicurazione", value: attiva ? `✅ ${veicolo.assicurazione.piano}
Scadenza: ${formattaDataOra(veicolo.assicurazione.scadenza)}` : "❌ Non assicurata", inline: false },
      { name: "📅 Immatricolata il", value: formattaDataOra(veicolo.immatricolataTimestamp ?? veicolo.immatricolataIl), inline: false }
    )
    .setFooter({ text: "MPRP • Registro veicoli" })
    .setTimestamp();
}

async function immatricolaAuto(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  if (destinatario.bot) return void await interaction.reply({ content: "❌ Non puoi intestare un veicolo a un bot.", flags: MessageFlags.Ephemeral });

  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }

  const targa = normalizzaTarga(interaction.options.getString("targa", true));
  if (targa.length < 3) return void await interaction.reply({ content: "❌ Targa non valida.", flags: MessageFlags.Ephemeral });
  const database = caricaDatabase();
  if (database.targhe[targa]) return void await interaction.reply({ content: `❌ La targa \`${targa}\` è già registrata.`, flags: MessageFlags.Ephemeral });
  database.utenti[destinatario.id] ??= creaUtenteVuoto(destinatario.id);
  preparaDatiUtente(database.utenti[destinatario.id], destinatario.id);
  const veicolo = {
    id: generaId("AUTO"), userId: destinatario.id,
    nome: controllo.documento.nome,
    cognome: controllo.documento.cognome,
    modello: interaction.options.getString("modello", true).trim(),
    targa,
    colore: interaction.options.getString("colore", true).trim(),
    cerchioni: interaction.options.getString("cerchioni", true).trim(),
    gancio: interaction.options.getString("gancio", true) === "presente",
    assicurazione: null,
    immatricolataIl: new Date().toISOString(),
    immatricolataTimestamp: Date.now(),
    immatricolataDa: interaction.user.id
  };
  database.targhe[targa] = veicolo;
  database.utenti[destinatario.id].auto.push(targa);
  salvaDatabase(database);
  creaBackupDatabase("immatricolazione");
  await interaction.reply({ embeds: [creaEmbedVeicolo(veicolo, "✅ Veicolo immatricolato")], flags: MessageFlags.Ephemeral });
  try { await destinatario.send({ embeds: [creaEmbedVeicolo(veicolo, "🚘 Nuovo veicolo intestato")] }); } catch {}
}

async function controllaTarga(interaction) {
  const targa = normalizzaTarga(interaction.options.getString("targa", true));
  const veicolo = caricaDatabase().targhe[targa];
  if (!veicolo) return void await interaction.reply({ content: `❌ Nessun veicolo trovato con targa \`${targa}\`.`, flags: MessageFlags.Ephemeral });
  await interaction.reply({ embeds: [creaEmbedVeicolo(veicolo, "🔎 Controllo targa")], flags: MessageFlags.Ephemeral });
}

function creaPulsantiAssicurazione(userId, targa) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`assicura:base:${userId}:${targa}`).setLabel("Base • 1.000 €").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`assicura:standard:${userId}:${targa}`).setLabel("Standard • 2.500 €").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`assicura:premium:${userId}:${targa}`).setLabel("Premium • 5.000 €").setStyle(ButtonStyle.Success)
  );
}

async function mostraAssicurazioni(interaction) {
  const proprietario = ottieniUtente(interaction.user.id);
  if (!proprietario.documento) {
    await interaction.reply({ content: "❌ Devi possedere un documento approvato per assicurare un veicolo.", flags: MessageFlags.Ephemeral });
    return;
  }

  const targa = normalizzaTarga(interaction.options.getString("targa", true));
  const database = caricaDatabase();
  const veicolo = database.targhe[targa];
  if (!veicolo || veicolo.userId !== interaction.user.id) {
    await interaction.reply({ content: "❌ Questa targa non risulta intestata a te.", flags: MessageFlags.Ephemeral });
    return;
  }
  const embed = new EmbedBuilder().setColor(COLORI.blu).setTitle(`🛡️ Assicurazione • ${targa}`).setDescription("Scegli un piano. Il costo viene prelevato dal conto bancario e la copertura dura 30 giorni.").addFields(
    { name: "Base • 1.000 €", value: ASSICURAZIONI.base.servizi },
    { name: "Standard • 2.500 €", value: ASSICURAZIONI.standard.servizi },
    { name: "Premium • 5.000 €", value: ASSICURAZIONI.premium.servizi }
  );
  await interaction.reply({ embeds: [embed], components: [creaPulsantiAssicurazione(interaction.user.id, targa)], flags: MessageFlags.Ephemeral });
}

async function acquistaAssicurazione(interaction, piano, proprietarioId, targa) {
  if (interaction.user.id !== proprietarioId) return void await interaction.reply({ content: "❌ Questa selezione non appartiene a te.", flags: MessageFlags.Ephemeral });
  const offerta = ASSICURAZIONI[piano];
  if (!offerta) return;
  const database = caricaDatabase();
  const veicolo = database.targhe[targa];
  const utente = database.utenti[proprietarioId];
  if (!veicolo || veicolo.userId !== proprietarioId || !utente) return void await interaction.reply({ content: "❌ Veicolo non trovato.", flags: MessageFlags.Ephemeral });
  preparaDatiUtente(utente, proprietarioId);
  if (utente.conto.banca < offerta.prezzo) return void await interaction.reply({ content: `❌ Saldo insufficiente. Servono **${formattaSoldi(offerta.prezzo)}**.`, flags: MessageFlags.Ephemeral });
  utente.conto.banca -= offerta.prezzo;
  const baseScadenza = veicolo.assicurazione?.scadenza > Date.now() ? veicolo.assicurazione.scadenza : Date.now();
  veicolo.assicurazione = { piano: offerta.nome, prezzo: offerta.prezzo, servizi: offerta.servizi, acquistataIl: Date.now(), scadenza: baseScadenza + DURATA_ASSICURAZIONE_MS };
  database.targhe[targa] = veicolo;
  salvaDatabase(database);
  await interaction.update({ embeds: [creaEmbedVeicolo(veicolo, "✅ Assicurazione attivata").addFields({ name: "Nuovo saldo", value: formattaSoldi(utente.conto.banca) })], components: [] });
}

async function resetAuto(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const database = caricaDatabase();
  const utente = database.utenti[destinatario.id];
  if (!utente?.auto?.length) return void await interaction.reply({ content: "❌ L’utente non possiede veicoli registrati.", flags: MessageFlags.Ephemeral });
  const numero = utente.auto.length;
  for (const targa of utente.auto) delete database.targhe[targa];
  utente.auto = [];
  salvaDatabase(database);
  await interaction.reply({ content: `✅ Rimossi **${numero} veicoli** intestati a ${destinatario}.`, flags: MessageFlags.Ephemeral });
  try { await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.rosso).setTitle("🗑️ Veicoli rimossi").setDescription("Lo Staff ha rimosso tutti i veicoli intestati al tuo profilo.")] }); } catch {}
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARRESTI E FEDINA PENALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

async function registraArresto(interaction) {
  if (!prenotaOperazioneUnica(`discord-arresto:${interaction.id}`)) return;

  const destinatario = interaction.options.getUser("utente-arrestato", true);
  if (destinatario.bot) {
    await interaction.reply({ content: "❌ Non puoi registrare l’arresto di un bot.", flags: MessageFlags.Ephemeral });
    return;
  }

  const nome = interaction.options.getString("nome", true).trim();
  const cognome = interaction.options.getString("cognome", true).trim();
  const controllo = controllaDocumentoEGeneralita(destinatario.id, nome, cognome);
  if (!controllo.valido) {
    await interaction.reply({ content: controllo.messaggio, flags: MessageFlags.Ephemeral });
    return;
  }

  const documento = controllo.documento;
  const dataNascita = interaction.options.getString("data-nascita", true).trim();
  const cittadinanza = interaction.options.getString("cittadinanza", true).trim();
  const eta = interaction.options.getInteger("eta", true);
  const etaCorretta = calcolaEta(documento.dataNascita);

  if (!testoUguale(dataNascita, documento.dataNascita)) {
    await interaction.reply({ content: `❌ La data di nascita non corrisponde al documento. Devi inserire **${documento.dataNascita}**.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (!testoUguale(cittadinanza, documento.cittadinanza)) {
    await interaction.reply({ content: `❌ La cittadinanza non corrisponde al documento. Devi inserire **${documento.cittadinanza}**.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (eta !== etaCorretta) {
    await interaction.reply({ content: `❌ L’età non è corretta. In base al documento l’utente ha **${etaCorretta} anni**.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const adesso = Date.now();
  const arresto = {
    id: generaId("ARR"),
    userId: destinatario.id,
    nome: documento.nome,
    cognome: documento.cognome,
    nomeCognome: `${documento.nome} ${documento.cognome}`,
    dataNascita: documento.dataNascita,
    cittadinanza: documento.cittadinanza,
    sesso: interaction.options.getString("sesso", true).trim(),
    cittaResidenza: interaction.options.getString("citta-residenza", true).trim(),
    eta: etaCorretta,
    numeroTelefono: interaction.options.getString("numero-telefono", true).trim(),
    reati: interaction.options.getString("reati", true).trim(),
    descrizioneAccaduto: interaction.options.getString("descrizione-accaduto", true).trim(),
    data: formattaDataOra(adesso),
    dataEventoTimestamp: adesso,
    firmaAgente: interaction.options.getString("firma-agente", true).trim(),
    agenteDiscordId: interaction.user.id,
    registratoIl: new Date(adesso).toISOString(),
    registratoTimestamp: adesso
  };

  const database = caricaDatabase();
  database.utenti[destinatario.id] ??= creaUtenteVuoto(destinatario.id);
  preparaDatiUtente(database.utenti[destinatario.id], destinatario.id);
  database.arresti[arresto.id] = arresto;
  database.utenti[destinatario.id].fedinaPenale.push(arresto.id);
  salvaDatabase(database);
  creaBackupDatabase("arresto");

  await interaction.reply({ embeds: [creaEmbedArresto(arresto, "✅ Arresto registrato")], flags: MessageFlags.Ephemeral });
  try {
    const canaleArresti = await client.channels.fetch(CANALE_ARRESTI);
    if (canaleArresti?.isTextBased()) {
      await canaleArresti.send({ content: `Nuovo arresto registrato per ${destinatario}.`, embeds: [creaEmbedArresto(arresto)] });
    }
  } catch (errore) {
    console.error("❌ Errore invio arresto nel canale:", errore);
  }
  try {
    await destinatario.send({
      content: "È stato registrato un arresto nella tua fedina penale.",
      embeds: [creaEmbedArresto(arresto)]
    });
  } catch {}
}

async function controllaFedinaPenale(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const database = caricaDatabase();
  const ids = database.utenti[destinatario.id]?.fedinaPenale ?? [];
  const arresti = ids.map(id => database.arresti[id]).filter(Boolean);

  if (!arresti.length) {
    await interaction.reply({ content: `✅ La fedina penale di ${destinatario} è pulita.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const testo = arresti.map((arresto, indice) =>
    `**${indice + 1}. ${arresto.id}**\nGeneralità: ${troncaTesto(arresto.nomeCognome, 150)}\nReati: ${troncaTesto(arresto.reati, 300)}\nData accaduto: ${troncaTesto(arresto.data, 100)}\nAgente: ${troncaTesto(arresto.firmaAgente, 150)}`
  ).join("\n\n");

  const blocchi = dividiInBlocchi(testo);
  await interaction.reply({
    embeds: blocchi.slice(0, 10).map((blocco, i) => new EmbedBuilder()
      .setColor(COLORI.rosso)
      .setTitle(i === 0 ? `🚔 Fedina penale di ${destinatario.username}` : `🚔 Fedina — pagina ${i + 1}`)
      .setDescription(blocco)),
    flags: MessageFlags.Ephemeral
  });
}

async function rimuoviArrestato(interaction) {
  const destinatario = interaction.options.getUser("utente", true);
  const idArresto = interaction.options.getString("id-arresto", true).trim().toUpperCase();
  const database = caricaDatabase();
  const arresto = database.arresti[idArresto];

  if (!arresto || arresto.userId !== destinatario.id) {
    await interaction.reply({ content: "❌ Arresto non trovato per questo utente.", flags: MessageFlags.Ephemeral });
    return;
  }

  delete database.arresti[idArresto];
  if (database.utenti[destinatario.id]) {
    database.utenti[destinatario.id].fedinaPenale = database.utenti[destinatario.id].fedinaPenale.filter(id => id !== idArresto);
  }
  salvaDatabase(database);

  await interaction.reply({ content: `✅ Arresto \`${idArresto}\` rimosso dalla fedina penale.`, flags: MessageFlags.Ephemeral });
  try {
    await destinatario.send({ embeds: [new EmbedBuilder().setColor(COLORI.giallo).setTitle("🗑️ Arresto rimosso").setDescription(`L’arresto con ID \`${idArresto}\` è stato rimosso dalla tua fedina penale.`)] });
  } catch {}
}

async function mostraPortaleFdo(interaction) {
  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORI.blu)
      .setTitle("🛡️ Portale dei dipartimenti")
      .setDescription("Accedi al portale per consultare cittadini, patenti, multe, fedine penali, veicoli e assicurazioni.")
      .addFields({ name: "Accesso", value: `[Apri il portale dei dipartimenti](https://mrp-database-departments.up.railway.app/login)` })
      .setTimestamp()],
    flags: MessageFlags.Ephemeral
  });
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  INVIO EMBED STAFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function interpretaColoreEmbed(valore) {
  const coloriNominati = {
    rosso: 0xED4245,
    blu: 0x3498DB,
    verde: 0x57F287,
    giallo: 0xFEE75C,
    viola: 0x9B59B6,
    arancione: 0xE67E22,
    nero: 0x000000,
    bianco: 0xFFFFFF,
    grigio: 0x2B2D31,
    discord: 0x5865F2
  };

  const testo = String(valore).trim().toLowerCase();
  if (coloriNominati[testo] !== undefined) return coloriNominati[testo];

  const esadecimale = testo.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(esadecimale)) {
    return Number.parseInt(esadecimale, 16);
  }

  return null;
}

function estensioneImmagine(allegato) {
  const estensione = path.extname(allegato?.name ?? "").toLowerCase();
  const consentite = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  return consentite.has(estensione) ? estensione : ".png";
}

function allegatoImmagineValido(allegato) {
  if (!allegato) return true;
  return !allegato.contentType || allegato.contentType.startsWith("image/");
}

async function inviaEmbed(interaction) {
  const coloreTesto = interaction.options.getString("colore", true);
  const canale = interaction.options.getChannel("canale", true);
  const messaggio = interaction.options.getString("messaggio", true).trim();
  const immagineIniziale = interaction.options.getAttachment("immagine-iniziale");
  const immagineGrande = interaction.options.getAttachment("immagine");
  const colore = interpretaColoreEmbed(coloreTesto);

  if (colore === null) {
    await interaction.reply({
      content: "❌ Colore non valido. Usa ad esempio `rosso`, `blu`, `#5865F2` oppure `5865F2`.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!allegatoImmagineValido(immagineIniziale) || !allegatoImmagineValido(immagineGrande)) {
    await interaction.reply({
      content: "❌ Puoi allegare solamente immagini PNG, JPG, GIF o WEBP.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!canale.isTextBased() || typeof canale.send !== "function") {
    await interaction.reply({
      content: "❌ Devi selezionare un canale testuale in cui il bot può scrivere.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const embed = new EmbedBuilder()
      .setColor(colore)
      .setDescription(messaggio);

    const files = [];

    if (immagineIniziale) {
      const nomeFile = `embed-iniziale${estensioneImmagine(immagineIniziale)}`;
      files.push({
        attachment: immagineIniziale.url,
        name: nomeFile
      });
      embed.setThumbnail(`attachment://${nomeFile}`);
    }

    if (immagineGrande) {
      const nomeFile = `embed-immagine${estensioneImmagine(immagineGrande)}`;
      files.push({
        attachment: immagineGrande.url,
        name: nomeFile
      });
      embed.setImage(`attachment://${nomeFile}`);
    }

    await canale.send({
      embeds: [embed],
      files
    });

    // Discord richiede che il comando venga riconosciuto: la risposta privata
    // viene eliminata subito, quindi nel server resta soltanto l’embed inviato.
    await interaction.deleteReply();
  } catch (errore) {
    console.error("❌ Errore invio embed:", errore);
    await interaction.editReply(
      "❌ Non sono riuscito a inviare l’embed. Controlla i permessi del bot e che le immagini non siano troppo pesanti."
    );
  }
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRESENZA BOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function avviaPresenzaAlternata(bot) {
  let mostraGioco = true;
  const aggiorna = () => {
    if (mostraGioco) {
      bot.user.setActivity("Codice Server:", { type: ActivityType.Playing });
    } else {
      bot.user.setActivity("0/50 Giocatori", { type: ActivityType.Listening });
    }
    mostraGioco = !mostraGioco;
  };

  aggiorna();
  if (timerPresenza) clearInterval(timerPresenza);
  timerPresenza = setInterval(aggiorna, 30_000);
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  INTERAZIONI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      await gestisciAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (!await controllaPermessoComando(interaction)) return;

      const azioni = {
        "registra-documento": registraDocumento,
        "registra-patente": registraPatente,
        "portafoglio": mostraPortafoglio,
        "passa-documento": passaDocumento,
        "passa-patente": passaPatente,
        "paga": pagaContanti,
        "bonifico": effettuaBonifico,
        "preleva": prelevaDenaro,
        "deposita": depositaDenaro,
        "rimuovi-documento": rimuoviDocumento,
        "rimuovi-patente": rimuoviPatente,
        "decreta-punti-patente": decretaPuntiPatente,
        "sequestro-patente": sequestraPatente,
        "multa": registraMulta,
        "paga-multa": pagaMulta,
        "controllo-multe": controlloMulte,
        "rimuovi-multa": rimuoviMulta,
        "registra-arresto": registraArresto,
        "controlla-fedina-penale": controllaFedinaPenale,
        "rimuovi-arrestato": rimuoviArrestato,
        "aggiungi-punti-patente": aggiungiPuntiPatente,
        "immatricola-auto": immatricolaAuto,
        "controlla-targa": controllaTarga,
        "assicurazione": mostraAssicurazioni,
        "reset-auto": resetAuto,
        "portale": mostraPortaleFdo,
        "embed": inviaEmbed,
        "servizio": async interaction => {
          const sub = interaction.options.getSubcommand();
          if (sub === "staff") return comandoServizioStaff(interaction);
          if (sub === "nome") return visualizzaServizioUtente(interaction);
          if (sub === "leadbord") return creaLeaderboardServizio(interaction);
        }
      };

      const funzione = azioni[interaction.commandName];
      if (funzione) await funzione(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modulo_richiesta_cittadinanza") {
        await inviaRichiestaDocumento(interaction, {
          nome: interaction.fields.getTextInputValue("nome"),
          cognome: interaction.fields.getTextInputValue("cognome"),
          dataNascita: interaction.fields.getTextInputValue("data-di-nascita"),
          cittadinanza: interaction.fields.getTextInputValue("cittadinanza"),
          nomeRoblox: interaction.fields.getTextInputValue("nome-roblox")
        });
        return;
      }
    }

    if (interaction.isButton()) {
      const [azione, userId] = interaction.customId.split(":");
      if (azione === "documento_accetta") return void await accettaDocumento(interaction, userId);
      if (azione === "documento_rifiuta") return void await rifiutaDocumento(interaction, userId);
      if (azione === "portafoglio_documento") return void await paginaDocumento(interaction, userId);
      if (azione === "portafoglio_conto") return void await paginaConto(interaction, userId);
      if (azione === "portafoglio_patente") return void await paginaPatente(interaction, userId);
      if (azione === "portafoglio_auto") return void await paginaAuto(interaction, userId);
      if (azione === "servizio_avvia") return void await gestisciAzioneServizio(interaction, "avvia", userId);
      if (azione === "servizio_pausa") return void await gestisciAzioneServizio(interaction, "pausa", userId);
      if (azione === "servizio_fine") return void await gestisciAzioneServizio(interaction, "fine", userId);
      if (azione === "servizio_leaderboard_indietro") return void await aggiornaLeaderboardServizio(interaction, Number(userId) - 1);
      if (azione === "servizio_leaderboard_avanti") return void await aggiornaLeaderboardServizio(interaction, Number(userId) + 1);
      if (azione === "apri_richiesta_cittadinanza") {
        await interaction.showModal(creaModalRichiestaCittadinanza());
        return;
      }

      if (azione === "assicura") {
        const [, piano, proprietarioId, targa] = interaction.customId.split(":");
        return void await acquistaAssicurazione(interaction, piano, proprietarioId, targa);
      }
    }
  } catch (errore) {
    console.error("❌ Errore interazione:", errore);
    const risposta = { content: "❌ Si è verificato un errore durante l’esecuzione.", flags: MessageFlags.Ephemeral };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(risposta);
      else await interaction.reply(risposta);
    } catch {}
  }
});

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AVVIO E CHIUSURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

client.once(Events.ClientReady, async bot => {
  console.log(`✅ Bot online come ${bot.user.tag}`);
  caricaDatabase();
  avviaBackupPeriodico();
  avviaPresenzaAlternata(bot);
  await ripristinaTimerSequestri();
  await inviaPannelloCittadinanza();
  console.log("✅ Database, backup, timer e pannello cittadinanza pronti.");
});

function chiusuraSicura(segnale) {
  console.log(`\n⚠️ Ricevuto ${segnale}: salvo un backup prima della chiusura.`);
  creaBackupDatabase("chiusura");
  if (timerBackup) clearInterval(timerBackup);
  if (timerPresenza) clearInterval(timerPresenza);
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => chiusuraSicura("SIGINT"));
process.on("SIGTERM", () => chiusuraSicura("SIGTERM"));
process.on("uncaughtException", errore => {
  console.error("❌ Errore non gestito:", errore);
  creaBackupDatabase("crash");
});
process.on("unhandledRejection", errore => {
  console.error("❌ Promise non gestita:", errore);
  creaBackupDatabase("promise");
});

(async () => {
  try {
    caricaDatabase();
    startFdoPortal({ databaseFile: DATABASE_FILE, port: PORTALE_FDO_PORT, client, arrestsChannelId: CANALE_ARRESTI });
    await registraComandi();
    await client.login(TOKEN);
  } catch (errore) {
    console.error("❌ Errore durante l’avvio:", errore);
  }
})();
