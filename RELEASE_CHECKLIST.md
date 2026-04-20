# Release Checklist

Use this checklist before staging/production rollout.

## 1) Services Up
- Start API: `npm run server`
- Start frontend: `npm run dev`
- Start AI service: `cd backend/ai_model && python -m uvicorn api:app --reload --port 8000`

## 2) Verification Commands
- `npm run verify:system`
- `npm run verify:live-quiz`
- `npm run verify:ai`

All three should pass.

## 3) Core Functional Smoke Tests
- Admin dashboard opens and shows green-ish system health badges in Overview.
- Teacher can start live session, open YouTube Recommendations, and get dynamic links.
- Teacher can launch live quiz and questions are generated (no placeholder-only flow unless explicitly enabled).
- Student can submit answers and results/leaderboard update.

## 4) Environment Flags
- Root `.env`
  - `VITE_API_URL` set
  - `VITE_AI_API_URL` set (recommended)
  - `ALLOW_PLACEHOLDER_QUIZ=false` in production
- `backend/ai_model/.env`
  - `YOUTUBE_API_KEY` set (recommended)
  - Optional strict mode: `REQUIRE_YOUTUBE_API=true`

## 5) Database Readiness
- Ensure migration adding `student_marks.live_quiz_session_id` is applied.
- Ensure `live_sessions.session_date` exists and is populated.

## 6) Final Sanity
- No terminal crashes/restart loops.
- No blocking console/network errors in teacher/admin flows.
- Backup DB snapshot taken before production deployment.
