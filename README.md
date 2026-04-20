# Engage Learn Monitor

An educational platform for managing student learning activities, quizzes, and progress tracking.

## Project structure

- **`frontend/`** – React (Vite) app: `src/`, `public/`, `index.html`. Build output: root `dist/`.
- **`backend/`** – Backend services:
  - **`backend/server/`** – Node.js (Express) API; serves the built frontend and handles auth, DB, uploads.
  - **`backend/ai_model/`** – Python (FastAPI) AI: chatbot and recommendations. Run with `cd backend/ai_model && python -m uvicorn api:app --reload --port 8000`.
- **`database/`** – SQL scripts and schema (e.g. `railway_core_schema.sql`).

Config files (Vite, Tailwind, TypeScript, etc.) stay at the repository root; Vite is configured with `root: "frontend"`. The canonical AI code lives in `backend/ai_model` only.
Legacy folders such as `AI/` and `teacher-quiz-app/` are retained for reference; production/runtime paths should continue using `backend/ai_model` and `backend/server`.

## Project Overview

Engage Learn Monitor is a comprehensive educational platform built with modern web technologies to facilitate interactive learning experiences.

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn-ui
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun

### Installation

1. Clone the repository:
```
sh
git clone <YOUR_GIT_URL>
```

2. Navigate to the project directory:
```
sh
cd <YOUR_PROJECT_NAME>
```

3. Install dependencies:
```
sh
npm install
```

4. Start the development server:
```
sh
npm run dev
```

The application will be available at `http://localhost:8080`.

### AI service (for dynamic recommendations + chatbot)

Run this in a second terminal:
```
cd backend/ai_model
python -m uvicorn api:app --reload --port 8000
```

Recommended env values:
- Root `.env`: `VITE_AI_API_URL=http://127.0.0.1:8000`
- `backend/ai_model/.env`: `YOUTUBE_API_KEY=...` (optional but improves recommendation quality)
- Optional strict mode: `REQUIRE_YOUTUBE_API=true` to fail AI startup when key is missing

### Building for Production

```
sh
npm run build
```

### Running Tests

```
sh
npm run test
```

### Stack Verification Commands

- `npm run verify:ai` — checks AI health, `/recommend`, and `/ask`
- `npm run verify:live-quiz` — checks API/DB + live-quiz schema readiness
- `npm run verify:system` — unified preflight (API + DB + live-quiz schema + AI)

## Features

- Student dashboard with progress tracking
- Teacher tools for creating quizzes and lessons
- Admin dashboard for system management
- QR code generation for student attendance
- Interactive learning workflows

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── contexts/        # React contexts
├── hooks/           # Custom hooks
├── lib/             # Utility functions
└── data/           # Demo data
