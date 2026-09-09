# MPRP Bot + Portale dipartimenti — uso locale con Visual Studio Code

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


## Portale DOJ • Giustizia

Il portale unico include anche una sezione DOJ/giustizia raggiungibile da `/doj`, con menu dedicato a:
- Dashboard giudiziaria
- Fascicoli e casi
- Mandati e ordini
- Procura / U.S. Attorney's Office
- Tribunale e calendario udienze
- Vittime e assistenza
- Documenti legali
- Audit e controlli

I dati DOJ vengono mantenuti in `mprp_doj.json`, separati dal database civile MPRP. Il menu laterale permette di passare tra **Dipartimenti** e **DOJ • Giustizia** senza cambiare sito.
