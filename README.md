# 🎓 AttendAI — Smart Attendance Tracker & Timetable Manager

> **Track minimum attendance targets, calculate safe bunks, scan timetable screenshots with OCR, and analyze attendance patterns with heatmaps.**

---

## 🌟 Overview

**AttendAI** is a modern, full-stack web application designed for college students to effortlessly track attendance across all enrolled subjects. It helps students maintain minimum attendance criteria (e.g., 75%), calculates how many classes can be safely skipped ("bunk room") or need to be attended to stay on target, parses timetable screenshots automatically using local OCR, and provides interactive calendar date selection.

---

## ✨ Key Features

### 📸 1. OCR Timetable Screenshot Scanner
- Upload any timetable image/screenshot to auto-extract weekly lecture slots.
- Auto-matches subject names against existing subjects in your database.
- 1-click creation of new subjects directly from the review drawer.
- Works offline via local **Tesseract.js** OCR (or optional **Gemini Vision API** integration).

### 📊 2. Analytics & Attendance Heatmap
- **12-Week Attendance Heatmap**: GitHub-style activity grid showing attendance density over time.
- **Weekly Breakdown Bar Chart**: Mon–Sat comparison of attended vs. missed lectures.
- **Metric Summary Cards**: Displays current streak, weekly count, best subject, and risk alerts.
- **Subject Detail Breakdown**: Visual progress bars and class count fractions (e.g. `9/16 classes`).

### 📅 3. Interactive Calendar & "Sense of Days"
- **Day Sensing**: Automatically senses the day of the week (e.g., Wednesday) and loads the exact scheduled timetable for that weekday.
- **Multi-Date Marking**: Log or inspect attendance for any past or future date.
- **Month Indicators**: Highlights days with attended (🟢), missed (🔴), or cancelled (⚪) classes.

### 📚 4. Subject Management & Safe Bunk Calculator
- **Duplicate Subject Prevention**: Automated name sanitization and 1-click subject deduplication/merging.
- **Flexible Modes**:
  - *Per-Subject Mode*: Calculates safe bunks and targets for each subject independently.
  - *Overall Combined Mode*: Aggregates all subjects into a single total percentage.
- **Smart Status Alerts**: `✓ Can skip 7 more classes` or `! Need 4 more classes to reach 75%`.

### 🌙 5. Dark / Light Mode & Responsive Design
- Includes an animated theme switcher with smooth CSS transitions.
- Blocking inline script prevents flash of wrong theme (FOCT) on page refresh.
- Fully responsive across desktop workstations and mobile smartphones with a top navigation bar.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router DOM, Vanilla CSS Tokens |
| **Backend** | Node.js, Express.js, Prisma ORM, Express-Validator |
| **Database** | SQLite (via Prisma) |
| **OCR Engines** | Tesseract.js (Offline Local Engine) + Gemini Vision API (Optional) |
| **Testing & Quality** | Jest (Backend Unit Tests), Oxlint (Frontend Linter) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

---

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/AyuRahate/Attendance_Tracker.git
   cd Attendance_Tracker
   ```

2. **Install Dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   JWT_SECRET=your_jwt_secret_key_here
   DATABASE_URL="file:./data/attendance.db"
   NODE_ENV=development
   # GEMINI_API_KEY=optional_gemini_api_key
   ```

4. **Initialize Database**
   In the `backend/` directory, push the Prisma schema to generate your SQLite database:
   ```bash
   npx prisma db push
   ```

5. **Start Development Servers**
   From the root project directory:
   ```bash
   npm run dev
   ```

   - **Frontend App**: `http://localhost:5173/`
   - **Backend API**: `http://localhost:5000/`

---

## 📁 Project Structure

```
Attendance_Tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (User, Subject, TimetableSlot, LectureRecord)
│   │   └── data/               # SQLite database file (attendance.db)
│   ├── src/
│   │   ├── engine/             # Attendance calculation logic & Jest tests
│   │   ├── middleware/         # Auth & error handling
│   │   └── routes/             # Express routes (auth, subjects, timetable, ocr, lectures, summary)
│   ├── index.js                # Express app entrypoint
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API client modules
│   │   ├── components/         # Navbar, CalendarPicker, TimetableManager
│   │   ├── context/            # AuthContext, ThemeContext, ToastContext
│   │   ├── pages/              # TodayPage, SubjectsPage, DashboardPage, SettingsPage, AuthPage
│   │   ├── App.jsx             # Routes & layout container
│   │   └── index.css           # Design tokens, themes & responsive CSS
│   ├── index.html
│   └── package.json
├── package.json                # Root script runner
└── README.md
```

---

## 🧪 Testing

Run backend unit tests with full coverage report:
```bash
cd backend
npm test
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
