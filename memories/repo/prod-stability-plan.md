# VetCare PROD Stability Plan
> Created: 2026-04-07 | Read this before implementing any infra/deployment changes

---

## Target URL
`https://vetcare-app-vpg5.onrender.com`

---

## Final Architecture (after implementation)

```
Developer PC
  └─ git push origin develop  (1 command)
       └─ GitHub Actions CI (auto)
            └─ Render DEV auto-deploys  (vetcare-dev, watches develop branch)

GitHub Actions → "Promote DEV to PROD" workflow (1 click, type "yes")
  └─ develop → main merge (auto)
       └─ Render PROD auto-deploys  (vetcare-app, watches main branch)

Render PROD web service  ──→  Neon PostgreSQL (vetcare_prod schema)
                          ──→  Cloudinary (images, PDFs, documents)

Render DEV web service   ──→  Render PostgreSQL (vetcare_dev schema) [disposable]
                          ──→  Cloudinary (same account, different folder)

UptimeRobot (external)   ──→  pings /api/v1/health every 5 min → keeps Render warm
GitHub Actions backup    ──→  daily pg_dump of Neon vetcare_prod → GitHub artifacts
```

---

## Component Decision Log

| Component | Decision | Reason |
|-----------|----------|--------|
| PROD DB | Neon PostgreSQL | Free forever (512MB), no expiry, PostgreSQL 15 |
| DEV DB | Render PostgreSQL | Disposable, auto-reseeds on expiry, no real data |
| File storage | Cloudinary | 25GB free forever, images + docs, CDN-served |
| Keep-alive | UptimeRobot | Free, 5-min ping, prevents Render cold starts |
| Monitoring | UptimeRobot | Email alert within 5 min of downtime |
| Backups | GitHub Actions | Daily pg_dump → artifact (90 days) + monthly Release (permanent) |
| PROD promotion | GitHub Actions promote.yml | Manual 1-click, develop→main |
| DEV promotion | Automatic | git push origin develop → auto-deploy |

---

## What Currently Exists in Codebase

### Storage abstraction — backend/src/utils/storage.ts
- `LocalStorage` class — fully implemented, writes to `/app/uploads` on disk
- `S3Storage` class — STUB ONLY (lines 97-136), logs warning, does NOT upload
- Factory: reads `STORAGE_DRIVER` env var (`local` | `s3`), defaults to `local`
- **Problem**: Render container disk is ephemeral — files wiped on every deploy/restart
- **Fix needed**: Add `CloudinaryStorage` class, set `STORAGE_DRIVER=cloudinary`

### File upload middleware — backend/src/middleware/upload.ts
- Uses multer memory storage (file.buffer in RAM)
- `uploadAny` (10MB), `uploadImage` (5MB), `uploadDocument` (20MB)
- MIME whitelist: jpeg/png/gif/webp/svg + pdf/word/excel/csv/txt

### Upload API routes — backend/src/routes/index.ts
- `POST /api/v1/files/upload` — single file
- `POST /api/v1/files/upload-multiple` — batch (max 10)
- `POST /api/v1/ai-copilot/analyze-scan` — AI image analysis
- `POST /api/v1/vet-hospitals/:id/documents` — KYC docs

### DB columns storing file URLs (docker/init.sql)
- `users.avatar_url` VARCHAR(500)
- `vet_profiles.profile_image` VARCHAR(500)
- `medical_records.file_url` VARCHAR(500)
- `hospital_documents.file_url` TEXT NOT NULL

### CI/CD — .github/workflows/
- `ci-cd.yml` — runs on push to develop/main: TypeScript, build, E2E, security, deploy hook
- `promote.yml` — manual workflow: merge develop→main (requires typing "yes")
- Both have `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true`

### render.yaml
- Has `databases:` block for Render free PostgreSQL (for DEV)
- DEV service: `DATABASE_URL` from `fromDatabase` (Render DB)
- PROD service: `DATABASE_URL` set manually in Render dashboard (will be Neon)

### render-start.sh
- Step 0: Schema setup with 4-retry loop (timeout 90s each)
- Step 1: 4 migration scripts (timeout 40s each)
- Step 2: Seed demo data if vet_profiles count = 0
- Step 3: `exec node dist/index.js` (port binds FIRST in index.ts)

---

## Credentials Needed From User (checklist)

### [ ] Step 1 — Neon PostgreSQL
- URL: https://neon.tech → Sign Up (GitHub login) → New Project: `vetcare-prod`
- Get: Connection Details → External connection string
- Format: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
- **Needed for**: render.yaml PROD DATABASE_URL + GitHub secret NEON_DATABASE_URL

### [ ] Step 2 — PROD Data Export (may be skippable)
- Run: `pg_dump "$RENDER_EXTERNAL_DB_URL" --schema=vetcare_prod --no-owner --no-acl -f prod_backup.sql`
- Skip if: PROD has only demo data (no real business users yet)

### [ ] Step 3 — Cloudinary
- URL: https://cloudinary.com → Sign Up Free → Dashboard
- Get: Cloud Name, API Key, API Secret
- **Needed for**: CloudinaryStorage implementation + Render env vars

### [ ] Step 4 — Render Environment Variables (PROD: vetcare-app)
User must add in Render Dashboard → vetcare-app → Environment:
- `DATABASE_URL` = Neon connection string
- `STORAGE_DRIVER` = `cloudinary`
- `CLOUDINARY_CLOUD_NAME` = from Cloudinary
- `CLOUDINARY_API_KEY` = from Cloudinary
- `CLOUDINARY_API_SECRET` = from Cloudinary

### [ ] Step 4b — Render Environment Variables (DEV: vetcare-dev)
User must add in Render Dashboard → vetcare-dev → Environment:
- `STORAGE_DRIVER` = `cloudinary`
- `CLOUDINARY_CLOUD_NAME` = from Cloudinary
- `CLOUDINARY_API_KEY` = from Cloudinary
- `CLOUDINARY_API_SECRET` = from Cloudinary
- NOTE: DATABASE_URL stays as Render DB (no change)

### [ ] Step 5 — GitHub Secrets
GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- `NEON_DATABASE_URL` = Neon connection string
- `BACKUP_NOTIFICATION_EMAIL` = user's email address

### [ ] Step 6 — UptimeRobot
- URL: https://uptimerobot.com → Sign Up Free
- Add monitor: HTTP(s), URL = `https://vetcare-app-vpg5.onrender.com/api/v1/health`, interval = 5 min
- Add email alert contact
- No code changes needed

---

## Code Changes to Implement (after credentials received)

### 1. backend/src/utils/storage.ts
- Add `CloudinaryStorage` class using `cloudinary` npm package
- `save()`: upload buffer to Cloudinary, return secure_url
- `delete()`: cloudinary.uploader.destroy(public_id)
- `getUrl()`: return Cloudinary URL
- Update factory: add `case 'cloudinary': return new CloudinaryStorage()`
- Add to backend/package.json: `"cloudinary": "^2.x"`

### 2. .github/workflows/backup.yml (NEW FILE)
- Cron: `0 2 * * *` (2 AM UTC daily)
- Uses NEON_DATABASE_URL secret
- Runs pg_dump for vetcare_prod schema
- Uploads as artifact: `vetcare-prod-backup-YYYY-MM-DD.sql` (90-day retention)
- On 1st of month: also uploads to GitHub Release (permanent)
- On failure: creates GitHub issue as alert

### 3. .github/workflows/promote.yml
- Add step BEFORE merge: trigger backup job and wait for it
- If backup fails: abort promotion, notify via issue

### 4. .github/workflows/ci-cd.yml
- After deploy step: add smoke test
- Tests: GET /api/v1/health (200), POST /auth/login with demo creds (200 + JWT)
- On failure: create GitHub issue "PROD deploy smoke test failed"

### 5. render.yaml
- PROD service DATABASE_URL: change from `fromDatabase` to env var placeholder
- Keep DEV service DATABASE_URL from Render DB (no change)

---

## Backup Strategy

| Type | Schedule | Retention | Storage |
|------|----------|-----------|---------|
| Daily dump | 2 AM UTC | 90 days | GitHub Actions artifacts |
| Monthly dump | 1st of month | Permanent | GitHub Releases |
| Pre-deploy snapshot | Before every PROD promotion | 30 days | GitHub Actions artifacts |

---

## Cost Summary (all free)

| Service | Free Limit | Notes |
|---------|-----------|-------|
| Neon PostgreSQL | 512MB, permanent | All for PROD |
| Render free DB | ~1 month | DEV only, disposable |
| Render Web (2 services) | 750hr/month each | DEV + PROD |
| Cloudinary | 25GB storage, 25GB/month bandwidth | Shared DEV+PROD |
| UptimeRobot | 50 monitors, 5-min interval | |
| GitHub Actions | 2000 min/month | CI + daily backup |
| GitHub Artifacts | 500MB | Rotate old backups |
| GitHub Releases | Unlimited | Monthly permanent backups |
| **Total** | **$0/month** | |

Optional: Render Starter ($7/month) for PROD web = zero cold starts guaranteed

---

## Implementation Order (when user provides credentials)

1. Cloudinary storage driver (code — prevents file loss)
2. backup.yml GitHub Action (code — daily backup)
3. promote.yml pre-deploy backup step (code)
4. ci-cd.yml post-deploy smoke test (code)
5. render.yaml PROD DATABASE_URL update (code)
6. npm install cloudinary in backend (dependency)
7. Commit + push → auto-deploys
