# SarkarHamariHai (सरकार हमारी है)

<p align="center">
  <img src="./public/logo-no-bg.png" alt="SarkarHamariHai Logo" width="140" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/frontend-React%20v19-blue.svg?logo=react&logoColor=white" alt="React v19" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/styling-Tailwind%20v4-38bdf8.svg?logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://capacitorjs.com/"><img src="https://img.shields.io/badge/mobile-Capacitor-blueviolet.svg?logo=capacitor&logoColor=white" alt="Capacitor" /></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/AI-Google%20Gemini-orange.svg?logo=google-gemini&logoColor=white" alt="Gemini AI" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/database-Supabase%20%2F%20Postgres-3ecf8e.svg?logo=supabase&logoColor=white" alt="Supabase / Postgres" /></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/deployment-Vercel-black.svg?logo=vercel&logoColor=white" alt="Vercel" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen.svg?logo=node.js&logoColor=white" alt="Node.js >= 18" /></a>
  <img src="https://img.shields.io/badge/Data%20Integrity-100%25%20Verified-success.svg?logo=checkmarx&logoColor=white" alt="Data Integrity" />
</p>

An AI-powered digital portal and cross-platform mobile application designed to aggregate, analyze, and recommend government examinations and job openings in India. By analyzing user education backgrounds and preferences, it provides smart notifications, personalized recommendations, and an integrated application tracker.

---

## 🚀 Key Features

- **🧠 AI Recommendations**: Personalized job recommendation matching engine powered by Google Gemini and Vertex AI.
- **⚡ Real-Time Tracking**: Interactive dashboard to trace exam applications and get key status updates.
- **📱 Cross-Platform Mobile**: Fully native Android application builds integrated via Capacitor.
- **🌐 Multilingual Support**: Optimized for regional localization, providing interfaces in English, Hindi (हिन्दी), and Marathi (मराठी).
- **☁️ Cloud Database**: Synchronized schema, real-time auth, and structured data storage backed by Supabase and PostgreSQL.
- **🛡️ Data Integrity & Self-Healing**: Deterministic verification engine ensuring 0 placeholders, 0 invalid categories, and clean, mapped official links.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion, Redux Toolkit, Lucide Icons.
- **Backend**: Node.js, Express, Vercel Serverless Functions.
- **Database**: PostgreSQL (via Supabase Client & Connection Pool).
- **Mobile Integration**: Capacitor Native Core & Android SDK Wrapper.
- **AI Engine**: Google Generative AI SDK (Gemini) & GCP Vertex AI.

---

## ⚙️ Setup & Installation

### 1. Prerequisites
Ensure you have the following installed on your machine:
- Node.js (v18 or higher)
- NPM (v9 or higher)
- Android Studio & Gradle (for compiling the Capacitor Android app)

### 2. Configure Environment Variables
Copy the template configuration file to create your local `.env`:
```bash
cp .env.example .env
```
Fill in the variables inside `.env` with your JWT secrets, Supabase API keys, and Google Gemini API keys.

> [!WARNING]
> Environment variables must be kept secure. Do not commit `.env` files to git. They are ignored by default under the `.env*` rules in our `.gitignore`.

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed the Database
Initialize your Supabase database schema and populate it with mock seed data:
```bash
# Seed local or Supabase tables
npm run seed

# Run migrations if adapting existing schemas
npm run migrate
```

### 5. Run the Local Development Servers
Starts the Vite dev server for the React frontend and nodemon for the Express API server concurrently:
```bash
npm run dev
```
The client website will be available at `http://localhost:5173`.

---

## 📱 Mobile App Development (Capacitor Android)

To build and compile the Android app:

### Sync Web Build to Android Source
Builds the production client bundle and synchronizes the assets with the Capacitor Android project:
```bash
npm run cap:sync
```

### Compile APK
Generates a debug build APK file (`app-debug.apk`) directly from the command line using the Gradle wrapper:
```bash
npm run cap:apk
```

### Run on Device / Emulator
Spawns the app on a connected Android phone or active virtual emulator:
```bash
npm run cap:run
```

---

## 🛡️ Data Integrity & Self-Healing Engine

SarkarHamariHai features a built-in deterministic verification and self-healing engine to maintain production data quality:
- **Centralized Link Resolver**: Resolves all scraped links (Indian Railways RRB zones, state PSC portals, High Courts, Central/State Ministries) to their exact official pages, completely eliminating generic placeholder links.
- **Continuous Healer Pipeline**: A scheduled cron job that runs page-by-page database sanitization to scrub old mock data, normalize categories, and reset invalid placeholders (e.g. converting default pay scale ranges like `15000 - 80000` to a standard clean `0 - 0` representation for unspecified salary ranges).
- **Verification Scripts**:
  - `node scripts/full-verification.js` : Fully audits all records inside Supabase for generic domains, broken links, invalid category flags, and empty values.
  - `node scripts/run-healer.js` : Manually executes the database self-healing cycles.

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
