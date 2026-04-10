# SarkarHamariHai

AI-powered platform for discovering, tracking, and preparing for government exams and jobs in India with personalized recommendations and smart insights.

---

## 🚀 Features

- 🤖 **AI Recommendation System (Gemini Powered)**
  - Personalized exam suggestions based on profile, interests, and qualifications  
  - Built-in **gap analysis inside exam details**  
  - Smart matching with 70%+ syllabus overlap  

- 🎯 **AI Roadmap Generator**
  - One-time generated personalized preparation roadmap  
  - Includes strategy, timeline, and resources  
  - Persistent and can only be minimized  

- 🔍 **Exam Discovery**
  - Browse all government exams across India  
  - Advanced filters (state, qualification, category, etc.)  
  - Real-time updated listings  

- ❤️ **User Dashboard**
  - Save (like) exams  
  - Track applied exams  
  - Manage application status  

- 🔔 **Real-Time Notifications**
  - Alerts for deadlines and exam updates  
  - Hourly sync using cron jobs  

- 📊 **Smart Insights**
  - Syllabus comparison  
  - Rank-wise exam suggestions  
  - Overlapping exam detection  

- 🌐 **Multi-Language Support**
  - English  
  - Hindi  
  - Marathi  

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion  
- **Backend**: Node.js, Express, Turso (SQLite)  
- **AI**: Google Gemini API  
- **Tooling**: TypeScript, Lucide React  
- **Hosting**: Vercel  
- **Cron Jobs**: cron-job.org  

---

## ⚙️ Installation & Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Setup Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
GEMINI_API_KEY=your_api_key_here
```

### 3. Start development server
```bash
npm run dev
```

### 4. Seed the database
```bash
npm run seed
```

---

## 🧠 AI System Overview

The AI system is designed to provide intelligent, efficient, and controlled recommendations.

### Capabilities

- Personalized exam recommendations  
- Gap analysis embedded within exam insights  
- One-time roadmap generation (non-repetitive)  
- Syllabus-based smart matching system  

### Behavior

- Runs only when triggered by the user  
- Prevents API overuse and failures  
- Ensures consistent output quality  

---

## ⚠️ Important Notes

- Ensure backend server is running before using AI features  
- Use a valid Gemini API key  
- Cron jobs must be active for:
  - Exam status synchronization  
  - Notification updates  

---

## 🔧 Future Improvements

- Complete syllabus database integration  
- Advanced AI ranking and scoring system  
- Premium UI/UX enhancements  
- Multi-language expansion  
- Faster dashboard with optimized data fetching  
- Offline roadmap access  
- Improved AI reliability and retry handling  

---

## 👨‍💻 Author

**Aayush Kumar, Shivam Kumar, Ayush Bharti**

---

⭐ Star this repository if you find it useful!
