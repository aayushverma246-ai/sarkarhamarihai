# 🏛️ SarkarHamariHai (सरकार हमारी है)

<p align="center">
  <img src="./public/logo-no-bg.png" alt="SarkarHamariHai Logo" width="160" />
</p>

<h3 align="center">SarkarHamariHai — Smart Indian Government Jobs & Examinations Aggregator</h3>

<p align="center">
  An AI-powered digital ecosystem and cross-platform mobile application designed to aggregate, sanitize, and personalize government examinations and job openings across India.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/frontend-React%20v19-blue.svg?style=for-the-badge&logo=react&logoColor=white" alt="React v19" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/styling-Tailwind%20v4-38bdf8.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://capacitorjs.com/"><img src="https://img.shields.io/badge/mobile-Capacitor-blueviolet.svg?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" /></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/AI-Google%20Gemini-orange.svg?style=for-the-badge&logo=google-gemini&logoColor=white" alt="Gemini AI" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/database-Supabase%20%2F%20Postgres-3ecf8e.svg?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase / Postgres" /></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/deployment-Vercel-black.svg?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js >= 18" /></a>
  <img src="https://img.shields.io/badge/Data%20Integrity-100%25%20Verified-success.svg?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Data Integrity" />
</p>

---

## 🚀 Key Highlights

*   **🧠 AI Recommender Engine**: Utilizes Google Gemini and Vertex AI semantic vector search to match applicant educational profiles and qualifications with open exam positions.
*   **🛡️ Production Data Guardrails**: Integrated centralized link resolver maps all scraped sources to official government portals. Deterministic self-healing engines ensure exactly `0` placeholder scales or broken configurations.
*   **📱 Native Mobile Portals**: Fully integrated cross-platform builds wrap React 19 into Android SDK components via Capacitor Core, supporting push notification queues.
*   **🌐 Regional Localization**: Dynamic UI translations with complete support for English, Hindi (हिन्दी), and Marathi (मराठी).
*   **⚡ Real-Time Tracking**: Interactive applicant dashboard to trace registration dates, fee closures, and application status.

---

## 📐 System Architecture & Data Flow

SarkarHamariHai implements a structured pipeline of scrapers, validators, and schedulers to maintain 100% data freshness:

```mermaid
graph TD
    A[Public Job Portals & RSS Feeds] -->|Raw Scraping| B[Base Scraper Engine]
    B -->|Lookup Links| C[Central Link Resolver]
    C -->|Verified Official URLs| D[(Supabase Database)]
    E[Cron-Job.org Schedulers] -->|Hourly/Daily Triggers| F[Self-Healing Healer Engine]
    F -->|Normalize Salary & Dates| D
    G[User Mobile Actions] -->|Profile Vectors| H[Gemini / Vertex AI Recommender]
    H -->|Semantic Match Scores| D
    D -->|Push Notification Despatch| I[Capacitor Android App]
```

---

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Redux Toolkit.
*   **Backend**: Node.js, Express, Vercel Serverless Architecture.
*   **Database**: PostgreSQL (via Supabase Client & Connection Pool).
*   **Mobile Framework**: Capacitor Native SDK Wrapper.
*   **AI Engine**: Google Generative AI SDK (Gemini) & GCP Vertex AI.
*   **Scheduler**: Cron-Job.org REST API Integrations.

---

## ⚙️ Setup & Installation

### 1. Configure Environment Variables
Copy the template configuration file to create your local `.env`:
```bash
cp .env.example .env
```
Fill in the variables inside `.env` with your JWT secrets, Supabase API keys, and Google Gemini API keys.

> [!WARNING]
> Environment variables must be kept secure. Never commit `.env` files to git. They are automatically ignored under the `.gitignore` rules.

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Seeding & Verification
Initialize your Supabase database schema and execute data verification:
```bash
# Seed local or Supabase tables
npm run seed

# Run the data integrity verification engine
npm run migrate
```

### 4. Run Development Servers
Starts the Vite dev server for the React frontend and nodemon for the Express API server concurrently:
```bash
npm run dev
```
The client website will be available at `http://localhost:5173`.

---

## 📱 Mobile App Development (Capacitor Android)

To build and compile the native Android app:

```bash
# Sync Web Build to Android Source
npm run cap:sync

# Compile APK (app-debug.apk)
npm run cap:apk

# Run on Device / Emulator
npm run cap:run
```

---

## 🛡️ Data Quality & Verification Engines

To maintain database integrity in production, the application utilizes three custom engines:

### 1. Centralized Link Resolver
Located in `backend/src/engines/link-resolver.js`, this module contains over 200+ case-insensitive mappings for official portals. It intercepts scraped URLs and resolves them to their correct state PSC, RRB zone, or High Court domain.

### 2. Deterministic Healer
Triggered daily via Vercel Serverless (`/api/cron/healer`), this engine runs a page-by-page database sanitization scan. It:
*   Sets mock/default salary ranges (`15k - 80k`) to `0 - 0` ("Not Specified").
*   Validates states and categorizes exams.
*   Uses stable ordering to prevent Postgres page-skips during background writes.

### 3. Verification Command Suite
*   `npm run migrate` (runs `scripts/full-verification.js`): Performs a deep audit on all records inside Supabase for generic domains, broken links, invalid category flags, and empty values.
*   `node scripts/run-healer.js` : Manually triggers the self-healing data pipeline locally.

---

## 📂 Project Structure

```
sarkarhamarihai/
├── .github/          # GitHub workflow actions
├── android/          # Capacitor native Android app project files
├── api/              # Vercel serverless function entrypoints
├── backend/          # Backend server models, routes, and engines
│   ├── src/          # Express route logic, database connectors, and AI engines
│   └── scripts/      # Data parsers, db audit utilities, and index managers
├── src/              # React frontend application source code
│   ├── components/   # UI widgets, cards, and navigation elements
│   └── store/        # Redux state slices and actions
├── public/           # Static assets, local logos, and images
├── scripts/          # Database migration and system healing helper utilities
├── .gitignore        # Standard Git rule ignores
├── vercel.json       # Vercel deployment routing and configuration
├── vite.config.mts   # Vite build pipelines and plugins
└── package.json      # Node dependency registry and build scripts
```

---

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
