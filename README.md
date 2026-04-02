<div align="center">

# 🐞 Code Clash

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socket.io&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)

*Code fast. Clash harder. Win the round.*

</div>

**Code Clash** is a real-time competitive coding game where you race against **SyntaxBot** — an AI opponent powered by Google Gemini. Pick your language (Python, JavaScript, or Java), choose a difficulty, and write a correct solution before the bot does. Wrong answers cost you a life and give you a hint. Three lives per round — lose them all and the round is forfeit. Every question is AI-generated and unique per match. Wins are tracked on a persistent leaderboard backed by MongoDB.

The full pipeline — question generation, code evaluation, and post-match feedback — runs through Google Gemini AI, so no two matches are ever the same.

---

## 📸 Screens

| Home | Arena | Win | Retry |
|------|-------|-----|-------|
| ![Home](assets/home.png) | ![Battle](assets/matchup.png) | ![Win](assets/battle-win.png) | ![Retry](assets/battle-retry.png) |

---

## ✨ Features

| | Feature | Details |
|-|---------|---------|
| 🤖 | **Gemini AI** | Unique question per match; code judged by Gemini with real hints & feedback |
| ⚡ | **Real-Time** | Socket.io countdown, live opponent status, bot typing animation with taunts |
| ❤️ | **Lives System** | 3 hearts per round — each wrong answer costs one; 0 lives = forfeit |
| ⏱️ | **Round Timer** | 3-minute per-round countdown, pulses red under 30 seconds |
| 🎉 | **Confetti** | Confetti burst when you win a round |
| 🏆 | **Leaderboard** | Persistent MongoDB rankings (wins, avg score, avg time, win streak) |
| 🎮 | **Session Score** | Live W/L counter in the top bar throughout a session |
| ⌨️ | **Power Editor** | Tab = indent, Ctrl+Enter = submit, live line counter |
| 📋 | **Copy Bot Code** | Copy SyntaxBot's revealed solution to clipboard after a round |
| 💡 | **Smart Hints** | Wrong answer? Gemini gives a targeted hint on every attempt |
| 🌐 | **3 Languages** | Python · JavaScript · Java |
| 🍄 | **3 Difficulties** | Easy 🌱 · Medium 🔥 · Hard ☠️ |

---

## ⚡ Running the Project

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

---

### Step 1 — Clone the repo

```bash
git clone https://github.com/ximecamacho/athenahacks2026.git
cd athenahacks2026
```

---

### Step 2 — Install dependencies

```bash
# Install frontend dependencies (from the project root)
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

---

### Step 3 — Set up environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your values:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/beetlebattle
GEMINI_API_KEY=your_google_gemini_api_key
```

---

### Step 4 — Start the backend

Open a terminal and run:

```bash
cd backend
npm run dev
```

The backend starts on **http://localhost:5000**

---

### Step 5 — Start the frontend

Open a **second terminal** (keep the backend running) and run:

```bash
# From the project root (not inside backend/)
npm start
```

The frontend opens at **http://localhost:5173**

Vite automatically proxies `/api` and `/socket.io` calls to `localhost:5000`, so both terminals need to be running at the same time.

---

> **Both terminals must be running for the game to work.**
> Backend = game logic, AI, and database. Frontend = the UI you play in.

---

## 📁 Project Structure

```
code-clash/
│
├── src/                        ← React frontend (Vite)
│   ├── App.jsx                 ← All screens + game logic (home / battle / result)
│   ├── index.jsx               ← React root entry point
│   ├── index.css               ← Global styles (Chelsea Market theme)
│   ├── index.html              ← HTML shell
│   ├── BattleScreen.jsx        ← Reserved for future component extraction
│   ├── StartMenu.jsx           ← Reserved for future component extraction
│   └── Results.jsx             ← Reserved for future component extraction
│
├── backend/                    ← Node.js / Express / Socket.io
│   ├── server.js               ← Entry point — Express + Socket.io setup
│   ├── sockets/
│   │   └── game.js             ← Matchmaking, bot logic, real-time game events
│   ├── services/
│   │   └── gemini.js           ← Question generation, code evaluation, feedback
│   ├── routes/
│   │   └── room.js             ← REST API: /api/player, /api/leaderboard, /api/match/:id
│   ├── db/
│   │   ├── connect.js          ← MongoDB connection
│   │   └── models/             ← Mongoose schemas: Player, Match, Leaderboard
│   ├── seed.js                 ← (Optional) seed script for test data
│   ├── .env.example            ← Environment variable template — copy to .env
│   └── package.json
│
├── assets/                     ← Screenshots for README
├── vite.config.js              ← Vite config — proxies /api and /socket.io to :5000
├── package.json
└── .gitignore
```

---

## 🎮 Difficulty Levels

| Level | Challenges |
|-------|-----------|
| 🌱 Easy | Print statements, variables, basic syntax |
| 🔥 Medium | Arithmetic, simple functions, conditionals |
| ☠️ Hard | Algorithms — reversal, min/max, string ops |

---

## 🌐 Supported Languages

| Language | Example prompt |
|----------|----------------|
| 🐍 Python | *"Create a variable `greeting = 'Hello, Python!'` and print it."* |
| 🟨 JavaScript | *"Declare a `const sum` that stores 14 + 28 and log it."* |
| ☕ Java | *"Write a method that takes a String and returns it reversed."* |

---

## 🔄 Game Pipeline

```
Player joins → Socket connects → find_match emitted
    ↓
Gemini generates unique question (language + difficulty)
    ↓
3-2-1 countdown → match_start with prompt
    ↓
Player writes code  ←→  SyntaxBot starts 20–30s timer
    ↓
submit_code → Gemini evaluates → correct? → match_over
                              → wrong?   → hint + retry
    ↓
Winner announced → leaderboard updated → next round or menu
```

---

## ⌨️ Editor Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Insert 4 spaces |
| `Ctrl + Enter` | Submit code |
| `Enter` (name field) | Start game |

---

## ⚠️ Security

- **Never commit `backend/.env`** — it contains real API keys and DB credentials
- `backend/.env` is gitignored; use `backend/.env.example` as a template
- If credentials were ever accidentally pushed, rotate them immediately

---

## 🛠️ Built With

React · Vite · Node.js · Express · Socket.io · MongoDB · Mongoose · Google Gemini API · CSS

---

## 👾 Built By

| Name | Role |
|------|------|
| Khushi Patel | Developer |

---

## 🗺️ Roadmap

- [ ] Live server-side code execution (sandboxed)
- [ ] Real 2-player matchmaking mode
- [ ] More languages (C++, Rust, Go)
- [ ] Sneaky attacks — throw banana peels mid-battle 🍌

---

*˚₊‧ʚ🐞ɞ‧₊˚ May your spots shine brightest ˚₊‧ʚ🐞ɞ‧₊˚*
