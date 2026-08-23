# HomePulse 🏡✨
> **Moderne, schlanke & serverless Haushalts- und Familienmanagement Web-App**  
> Entwickelt für das kostenlose Azure-Kontingent, mit KI-Sprachassistenten und Vorbereitung für Google Play In-App-Käufe.

---

## 🌟 Highlights & Funktionen

- 🎙️ **Smart Voice & KI-Assistent:** Freitext- und Spracheingabe via Web Speech API (z. B. *"Setze Bio-Eier und Hafermilch auf die Einkaufsliste für Papa und trage für Freitag 16 Uhr Kindergeburtstag im Kalender ein"*). Die Azure Function `/api/ai-parse` liefert strukturierte JSON-Aktionen mit einer interaktiven Bestätigungs-Card im UI zur Freigabe.
- 🛒 **Gemeinsame Einkaufsliste:** Kategorisierung (Frische, Vorrat, Drogerie etc.), Zuweisung zu Haushaltsmitgliedern ("Papa bringt mit"), Realtime-Abhaken mit optischem Feedback und Konfetti-Effekt.
- 📅 **Familienkalender:** Farbcodierte Zuordnung nach Mitgliedern, Agenda- & Monatsansichten, Schnell-Erstellung und Filterung.
- 📌 **Familien-Pinnwand & Status-Feed:** Tagesübersicht, Status-Updates (*"Bin auf dem Heimweg"*, *"Essen steht im Kühlschrank"*), Wichtig-Notizen und Emoji-Reaktionen.
- 👥 **Mitglieder- & Status-Sharing:** Profile mit individuellen Farben, Avataren, Live-Status (*"Zuhause"*, *"Unterwegs"*, *"Büro"*, *"Schule"*) und Datenschutz-Toggle zur Deaktivierung der Freigabe.
- 💳 **Google Play In-App-Käufe (IAP):** W3C Digital Goods API (`window.getDigitalGoodsService`), Sandbox-Simulator für Browser, Backend-Token-Validierung (`POST /api/billing/verify`) und Paywall-Modal für Family Plus Abos (`monthly`, `yearly`, `lifetime`).
- ⚡ **Offline-First & Sofort Testbar:** Funktioniert dank integriertem LocalStorage-Sync und intelligentem NLP-Fallback sofort im Browser – ohne Zwang zur Einrichtung eines Azure- oder KI-Accounts.

---

## 🏗️ Kostenlose Azure Serverless-Architektur

```text
┌─────────────────────────────────────────────────────────────┐
│               HomePulse Next.js App Router                  │
│       Tailwind CSS + Lucide Icons + Web Speech API         │
│          (Host: Azure Static Web Apps - Free Tier)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ REST Calls (/api/*)                 │
            ▼                                     ▼
┌────────────────────────────────┐   ┌────────────────────────┐
│     Azure Functions (v4)       │   │  Google Play Billing   │
│   Node.js / TS Consumption     │   │   Digital Goods API    │
│  - /api/ai-parse (LLM & NLP)   │   │  & Backend Validation  │
│  - /api/shopping (CRUD)        │   └────────────────────────┘
│  - /api/calendar (CRUD)        │
│  - /api/feed (CRUD)            │
│  - /api/members (CRUD)         │
│  - /api/billing (IAP Verify)   │
└───────────────┬────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│             Azure Cosmos DB for NoSQL (Free Tier)           │
│        1.000 RU/s & 25 GB kostenlos für immer               │
│      Containers: members, shopping, calendar, feed, subs    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Projektstruktur (Monorepo)

```text
/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD Pipeline für Azure SWA
├── api/                        # Azure Functions Backend (v4 TypeScript)
│   ├── src/
│   │   ├── functions/
│   │   │   ├── aiParser.ts     # NLP & LLM Endpoint (Gemini/OpenAI + lokaler Parser)
│   │   │   ├── calendar.ts     # CRUD-Endpoints für Familientermine
│   │   │   ├── shopping.ts     # CRUD-Endpoints für Einkaufslisten
│   │   │   ├── feed.ts         # CRUD-Endpoints für Pinnwand & Status-Updates
│   │   │   ├── members.ts      # CRUD-Endpoints für Haushaltsmitglieder
│   │   │   └── billing.ts      # Google Play Token-Validierung & Abo-Verwaltung
│   │   └── shared/
│   │       ├── db.ts           # Cosmos DB Client & autom. Memory-Fallback
│   │       └── types.ts        # Gemeinsame TypeScript Interfaces
│   ├── host.json
│   ├── local.settings.json.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Next.js Frontend (App Router, Tailwind)
│   ├── public/
│   │   ├── manifest.json       # Web App Manifest für Android & TWA
│   │   ├── icon.svg            # App Icon
│   │   └── .well-known/
│   │       └── assetlinks.json # Google Play Store TWA Verifikation
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css     # Glassmorphism & Modern UI Styles
│   │   │   ├── layout.tsx      # Root Layout & PWA Meta-Tags
│   │   │   └── page.tsx        # Haupt-Dashboard & Navigation
│   │   ├── components/
│   │   │   ├── Header.tsx          # Profil-Switcher, Live-Status & Premium Badge
│   │   │   ├── DashboardView.tsx   # Tages-Glance, Shortcuts & Terminvorschau
│   │   │   ├── VoiceAssistant.tsx  # Mic FAB, Web Speech STT & Aktions-Freigabe
│   │   │   ├── ShoppingList.tsx    # Kategorisiertes Abhaken, Filter & Zuweisung
│   │   │   ├── CalendarView.tsx    # Monats- & Listenkalender mit Farbcodierung
│   │   │   ├── FamilyFeed.tsx      # Pinnwand, Status-Broadcast & Emoji-Reaktionen
│   │   │   ├── MemberManager.tsx   # Mitglieder, Profile & Datenschutz-Toggle
│   │   │   └── PremiumModal.tsx    # Google Play In-App-Kauf Paywall & Abo-Pläne
│   │   └── lib/
│   │       ├── api.ts          # Client API-Layer mit Fallback-Mechanismus
│   │       ├── billing.ts      # Google Play Digital Goods API & Sandbox Client
│   │       ├── mockData.ts     # Realistische Beispieldaten für Familie
│   │       ├── storage.ts      # LocalStorage Sync & Event Bus
│   │       └── types.ts        # Typdefinitionen
│   ├── .env.example
│   ├── next.config.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── package.json                # Monorepo Scripts
└── README.md
```

---

## 🚀 Schnellstart & Lokale Entwicklung

### Voraussetzungen
- Node.js 18+ (oder 20+)
- npm 9+

### 1. Repository klonen & Abhängigkeiten installieren
```bash
# Im Hauptverzeichnis:
npm run install:all
```

### 2. Frontend im Entwicklungsmodus starten
```bash
npm run dev:frontend
```
Öffne [http://localhost:3000](http://localhost:3000) im Browser.  
> **Hinweis:** Die App ist sofort voll funktionsfähig! Sie verwendet standardmäßig den integrierten LocalStorage- und NLP-Fallback, sodass du Sprachbefehle, Einkaufslisten, Kalender und Premium-Käufe direkt ausprobieren kannst.

### 3. Azure Functions API lokal starten (Optional)
Installiere die Azure Functions Core Tools (`npm i -g azure-functions-core-tools@4`) und starte das Backend:
```bash
# Kopiere die Beispiel-Konfiguration
cp api/local.settings.json.example api/local.settings.json

# API starten (Port 7071)
npm run dev:api
```

### 4. Direkt in Android Studio öffnen & ausführen 📱
Das native Android-Projekt ist bereits fertig eingerichtet (`frontend/android/`):
```bash
# Projekt in Android Studio öffnen:
npm run open:android

# Oder Änderungen synchronisieren:
npm run build:android
```
In Android Studio:
1. Wähle dein Android-Gerät oder den Emulator aus.
2. Drücke auf den grünen **Run-Button ▶️**.
3. Die HomePulse-App startet als native Android-App inklusive Mikrofon-Support für Sprachbefehle!

---

## 🤖 KI-Sprachbefehle & Beispiele

Der Sprachassistent reagiert auf natürliche deutsche Spracheingaben und zerlegt komplexe Sätze in Einzelaktionen:

- *"Setze Bio-Eier und Hafermilch auf die Einkaufsliste für Papa und trage für Freitag 16 Uhr Kindergeburtstag im Kalender ein"*
- *"Schreib 2kg Äpfel und Vollkornbrot auf die Einkaufsliste für Mama"*
- *"Trage für morgen um 09:00 Uhr Zahnarzttermin im Kalender ein"*
- *"Bin auf dem Heimweg von der Arbeit"*

Nach dem Sprechen oder Tippen erscheint die **Aktions-Freigabekarte**:
- Prüfe die erkannten Elemente (Einkauf, Termin, Status).
- Wähle einzelne Aktionen per Checkbox an oder ab.
- Klicke auf **"Bestätigen & Ausführen"** – alle Daten werden sofort in Kalender & Einkaufsliste übertragen.

---

## 💳 Google Play In-App-Käufe (IAP) Setup

HomePulse unterstützt die offizielle **W3C Digital Goods API** für Trusted Web Activities (TWA) im Google Play Store.

### 1. In der Google Play Console anlegen:
1. Erstelle eine neue App (z.B. `com.homepulse.familyapp`).
2. Unter **Monetarisieren > In-App-Produkte / Abonnements**:
   - `homepulse_family_monthly`: Monatsabo (z. B. 3,99 €)
   - `homepulse_family_yearly`: Jahresabo (z. B. 29,99 €)
   - `homepulse_lifetime`: In-App-Produkt Einmalkauf (z. B. 69,99 €)

### 2. TWA erstellen & verpacken (Bubblewrap oder PWABuilder):
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://deine-app.azurestaticapps.net/manifest.json
bubblewrap build
```
Trage den SHA-256 Fingerprint deines Release-Keys in `frontend/public/.well-known/assetlinks.json` ein.

### 3. Backend-Prüfung aktivieren (`api/local.settings.json`):
```json
{
  "GOOGLE_PLAY_PACKAGE_NAME": "com.homepulse.familyapp",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL": "play-service@your-project.iam.gserviceaccount.com",
  "GOOGLE_PLAY_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

---

## ☁️ Deployment auf Azure (Kostenloses Kontingent)

### 1. Azure Cosmos DB (Kostenlos)
1. Erstelle ein **Azure Cosmos DB for NoSQL** Konto im Azure Portal.
2. Wähle beim Erstellen die Option **"Apply Free Tier Discount"** (1.000 RU/s & 25 GB kostenlos für immer).
3. Kopiere den Primary Connection String in deine GitHub Secrets oder Azure Configuration unter `COSMOS_DB_CONNECTION_STRING`.

### 2. Azure Static Web Apps (Free Tier)
1. Erstelle eine **Static Web App** im Azure Portal (Tarif: *Free*).
2. Verknüpfe dein GitHub-Repository.
3. Konfiguriere die Build-Details:
   - **App location:** `/frontend`
   - **Api location:** `/api`
   - **Output location:** `.next`
4. Füge den von Azure generierten Token als GitHub Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` ein.
5. Jeder Push auf den `main`-Branch löst über `.github/workflows/deploy.yml` automatisch den Build und das Deployment aus.

---

## 📄 Lizenz
MIT License © 2026 HomePulse Team.
