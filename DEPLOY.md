# Deploying LMS (AWS MySQL + S3, Render web service)

This app uses **MySQL** for relational data. **File binaries** (QR PNGs, chapter PDFs, topic PPT/PDF) are stored in **Amazon S3** when S3 env vars are set; MySQL keeps **paths only** (for example `textbook/chapter_5.pdf`, `qrcodes/12_DATA.png`). The API serves them at `GET /uploads/...` by streaming from S3 or local disk.

### Same behaviour as on your PC (PDFs, PPTs, uploads)

- The **codebase** is the same; production uses the same routes (`/api/...`, `/uploads/...`).
- The **`uploads` folder is listed in `.gitignore`**, so your existing PDFs/PPTs/QR images are **not** pushed to Git. To have them on the live server you must either:
  1. **Copy them to S3** (recommended on Render) using the sync command below, **or**
  2. Run **without** S3 and accept that files on the server disk can be **lost on redeploy** (not recommended).
- After S3 is configured, **new** uploads from the admin UI are written to S3 automatically; the app still stores **relative paths** in MySQL and the browser loads files as `https://your-app.onrender.com/uploads/...` (the server streams from S3).
- **Path not found** only happens if the path in MySQL does not exist in S3 (or local disk in dev). Keep DB paths and object keys identical.

## 1. AWS RDS (MySQL)

1. Create an RDS MySQL instance (same major version as your dump, e.g. 8.0).
2. Allow inbound **3306** from Render: use the Render outbound IPs doc, or temporarily `0.0.0.0/0` for testing (tighten later).
3. Create database `lms` (or your name) and import your SQL dump.
4. Note **endpoint**, **port**, **username**, **password**.

The server enables TLS automatically when the hostname contains `rds.amazonaws.com`, or set `MYSQL_SSL=1`. If you see certificate errors, set `MYSQL_SSL_REJECT_UNAUTHORIZED=0` (less strict; use only if needed).

## 2. Object storage for uploads (AWS S3 or compatible)

1. Create a bucket (e.g. `your-school-lms-uploads`) in the storage provider.
2. Create access keys with permissions for object read/write (`PutObject`, `GetObject`, `HeadObject` equivalent).
3. The app does **not** require public bucket ACLs: the Render service reads objects with the key and streams them over `/uploads/*`.

**Migrating your whole local `uploads` folder (matches DB paths):**

From the project root, with the same env vars as production (`S3_BUCKET`, `AWS_*`, `AWS_REGION`):

```bash
npm run sync:uploads-s3
```

Or use AWS CLI:

```bash
aws s3 sync ./uploads s3://your-bucket/
```

Keys in object storage must match DB paths (e.g. `textbook/foo.pdf`, `qrcodes/1_DATA.png`). The server logs on startup whether it is using **S3** or **local** `[uploads] Storage: ...`.

### Cloudflare R2 example env vars

- `S3_BUCKET=<bucket-name>`
- `AWS_REGION=auto`
- `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
- `S3_FORCE_PATH_STYLE=1`
- `AWS_ACCESS_KEY_ID=<r2-access-key-id>`
- `AWS_SECRET_ACCESS_KEY=<r2-secret>`

## 3. Render (Node web service)

1. New **Web Service**, connect your Git repo.
2. **Build command:** `npm install --include=dev && npm run build`  
   (Required so **Vite** and other devDependencies are installed; otherwise you get `vite: not found`.)
3. **Start command:** `npm start`
4. **Uploads without AWS:** add a **Persistent Disk**, mount e.g. `/var/data`, then set env `UPLOADS_DIR=/var/data/uploads`. Copy your local `uploads/` contents into that disk once (or re-upload files in the app). Without a disk or S3, `/uploads/...` will 404 after deploy.
4. **Environment** (minimum):

| Variable | Example / note |
|----------|----------------|
| `NODE_ENV` | `production` |
| `PORT` | Set automatically by Render |
| `MYSQL_HOST` | RDS endpoint |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | RDS user |
| `MYSQL_PASSWORD` | RDS password |
| `MYSQL_DATABASE` | `lms` |
| `S3_BUCKET` | Bucket name |
| `AWS_REGION` | e.g. `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `APP_BASE_URL` | `https://<your-service>.onrender.com` (for QR / student links) |
| `VITE_API_URL` | **Same** as public URL, set at **build** time so the SPA calls the correct API |

Optional: `QR_BASE_URL` if QR codes must open a different host than `APP_BASE_URL`.

5. Open `https://<your-service>.onrender.com/api/db-check` — should return `{"ok":true}`.

### Why `VITE_API_URL` on Render?

Vite bakes this into the frontend at build time. Set it in Render to your service URL (e.g. `https://my-lms.onrender.com`) so production builds do not default to an empty API base.

## 4. Local development without S3

Unset `S3_BUCKET` or omit AWS keys; files go under `./uploads` as before.

## 5. PPT → PDF on Render

Conversion uses LibreOffice (`soffice`). The default Render Node image may **not** include it, so in-browser PDF preview for uploaded PPT may be skipped until you use a **Docker** deploy with LibreOffice installed or convert files before upload.

## 6. Railway DB + Render (alternative)

If AWS setup is delayed, you can use Railway MySQL + Render for the app:

1. Create MySQL in Railway and copy `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
2. Import your SQL dump into Railway DB.
3. In Render env vars, set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` from Railway values.
4. Keep `VITE_API_URL` and `APP_BASE_URL` as your Render app URL.
5. For persistent file uploads on Render, still use S3 as documented above (recommended).

### Optional keepalive script

Repository includes `scripts/keepalive.py` to ping Render and Railway MySQL periodically.

```bash
pip install -r scripts/requirements-keepalive.txt
```

Set env vars, then run:

```bash
python scripts/keepalive.py
```

Required env vars (one or both targets):

- `RENDER_HEALTH_URL=https://your-app.onrender.com/api/health`
- `RAILWAY_MYSQL_HOST`, `RAILWAY_MYSQL_PORT`, `RAILWAY_MYSQL_USER`, `RAILWAY_MYSQL_PASSWORD`, `RAILWAY_MYSQL_DATABASE`

Optional:

- `PING_INTERVAL_SECONDS=240`
- `REQUEST_TIMEOUT_SECONDS=15`
