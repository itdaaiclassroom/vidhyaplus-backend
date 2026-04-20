# Deploy to Render

## 1. Connect repository

1. Go to [dashboard.render.com](https://dashboard.render.com).
2. **New → Web Service**.
3. Connect your GitHub (or GitLab) account if needed, then select the **Digital-learnning** repo.
4. Use the same branch you push to (e.g. `main`).

## 2. Settings (if not using render.yaml)

| Field | Value |
|-------|--------|
| **Name** | `digital-learning` (or any name) |
| **Region** | Oregon (or nearest) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run server` or `npm start` (do **not** use `npm run build && ...` here; build runs in Build Command only) |
| **Instance Type** | Free |

## 3. Environment variables

In **Environment** tab, add:

| Key | Value |
|-----|--------|
| `NODE_VERSION` | `20` |
| `MYSQL_HOST` | Your MySQL host (e.g. from Render MySQL add-on or external DB) |
| `MYSQL_PORT` | e.g. `3306` |
| `MYSQL_USER` | MySQL user |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Database name (e.g. `lms`) |
| `GROQ_API_KEY` | Your GROQ API key (for AI chatbot) |

Optional:

- `QUIZ_API_URL` = `https://quiz-1-qo31.onrender.com` (defaults to this)

Render sets `PORT` automatically; the app uses it.

## 4. Database on Render (optional)

- In the same Render project: **New → MySQL**.
- After it’s created, open the MySQL service → **Connect** and copy the **Internal** (or External) URL / vars.
- Add `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` to the **Web Service** environment (Internal values if both are on Render).
- Run your schema once (e.g. from your machine with the External URL, or a one-off job):  
  `database/railway_core_schema.sql` and any other SQL you use.

## 5. Deploy

- Click **Create Web Service** (or **Deploy** if you used the blueprint).
- Wait for the build and start to finish. The app will be at `https://<your-service-name>.onrender.com`.

## 6. After first deploy

- Open the app URL and log in (admin/teacher/student as per your DB).
- If you see “Database connection failed”, check the MySQL env vars and that the schema has been run.
