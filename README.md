# IPRP Bot + Portale FDO — uso locale con Visual Studio Code

Questo progetto è configurato per essere eseguito in locale da Visual Studio Code. Non contiene configurazioni o istruzioni di pubblicazione cloud.

## Avvio

1. Apri questa cartella in Visual Studio Code.
2. Copia `.env.example` come `.env`.
3. Inserisci in `.env` `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `PORTALE_PASSWORD` e un valore casuale lungo per `PORTALE_SECRET`.
4. Nel terminale integrato esegui `npm install` una sola volta.
5. Premi `F5` e seleziona **Avvia bot e portale**, oppure esegui `npm start`.
6. Apri [http://localhost:3000/login](http://localhost:3000/login) e accedi con `PORTALE_USER` e `PORTALE_PASSWORD`.

## Dati locali

I dati del bot, i backup e le operazioni elaborate sono salvati nella cartella `data/` del progetto. Questa cartella viene creata automaticamente e non viene inclusa in Git.

Per usare un'altra posizione, imposta `DATA_DIR` nel file `.env` con un percorso assoluto.

## Sviluppo

- `npm run dev`: riavvia automaticamente il programma quando modifichi un file JavaScript.
- `npm run check`: controlla la sintassi dei file principali.

Il cookie di accesso funziona su `http://localhost`. Se in futuro pubblichi il portale con HTTPS, imposta `PORTALE_HTTPS=true`.

## Aggiornamenti recenti

- Nel canale `1543228800735903767` il bot pubblica una sola volta il pannello per la richiesta di cittadinanza, con pulsante che apre un modulo Discord con le stesse 5 domande di `/registra-documento`.
- Alla prima entrata di un player vengono assegnati automaticamente i ruoli `1543228774164725781` e `1543228774164725783`.
- Dopo l'accettazione del documento, il ruolo `1543228774164725781` viene sostituito dal ruolo `1543228774164725782`; il ruolo `1543228774164725783` resta assegnato.
- Aggiunto `/servizio staff`, `/servizio nome utente` e `/servizio leadbord` per il servizio staff.
- Il servizio salva il tempo in modo persistente e permette avvio, pausa/break e fine servizio; la leaderboard mostra fino a 30 operatori su 2 pagine da 15.
- Le immagini fornite sono state integrate nel portale come `ced-iprp-logo.png` e `minnesota-state-patrol.png`.


## Portale DOJ

Il portale usa lo stesso servizio web del portale dei dipartimenti e dispone di un accesso separato. Credenziali predefinite DOJ: **utente `DOJ` / password `DOJ`**. Puoi cambiarle con `DOJ_USER` e `DOJ_PASSWORD`.

Le funzioni DOJ includono fascicoli, udienze, mandati, programma vittime e documenti ufficiali. Le autorizzazioni operative sono configurabili con `DOJ_ATTORNEY_USERS`, `DOJ_JUDGE_USERS`, `DOJ_PROSECUTOR_USERS` e `DOJ_DOCUMENTS_OWNER`. Con la configurazione predefinita l'utente DOJ è abilitato a tutte le funzioni, così il portale è immediatamente utilizzabile nel roleplay.

Per collegare le operazioni ai canali Discord imposta `DOJ_LOG_CHANNEL_ID` oppure i singoli `DOJ_FASCICOLI_CHANNEL_ID`, `DOJ_UDIENZE_CHANNEL_ID`, `DOJ_MANDATI_CHANNEL_ID`, `DOJ_VITTIME_CHANNEL_ID` e `DOJ_DOCUMENTI_CHANNEL_ID`.

### Railway e persistenza

Su Railway imposta `DATA_DIR=/var/data` **e monta un Railway Volume su `/var/data`**. Il database civile resta in `iprp_civili.json`; il database DOJ viene salvato in `doj_records.json`. Un aggiornamento del repository non sostituisce questi file perché sono fuori dal repository. Se il Volume viene mantenuto, i dati già presenti (ad esempio 17 cittadini e 8 patenti) restano dopo il deploy.
