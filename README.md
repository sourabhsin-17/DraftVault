# Autosave Form Management System (DraftVault)

A full-stack, production-oriented SaaS platform for managing lengthy multi-step application forms with live 800ms debounced autosave, exponential backoff retry recovery, optimistic concurrency conflict resolution, secure document uploads, and role-based user and administrator dashboards.

## Architecture & Technology Stack

- **Frontend**: React 19, TypeScript, React Router, Tailwind CSS v4 (light & dark themes)
- **Backend**: Node.js 22, Express 4, REST API architecture
- **Database**: SQLite (`node:sqlite` built into Node.js 22 with WAL mode, foreign keys, transactions, and versioned SQL migrations)
- **Validation & Security**: Zod schemas, `crypto.scrypt` password hashing, HTTP-only `SameSite` session cookies, CSRF token verification, sliding-window rate limiting, and magic-byte file signature checks via Multer

## Project Structure

```
├── server.ts                  # Express + Vite/static entry point (port 3000)
├── server/
│   ├── app.ts                 # Modular Express application factory
│   ├── config/                # Environment & modular 5-step form schema
│   ├── db/                    # SQLite connection & relational migrations
│   ├── middleware/            # Auth, RBAC, CSRF, rate limiter, Multer upload, error handler
│   ├── services/              # Auth, Drafts/Concurrency, Submissions, Uploads, Admin
│   ├── controllers/           # Route handlers
│   ├── routes/                # REST endpoints
│   └── validation/            # Zod request validation schemas
├── src/
│   ├── components/            # Layout shell, form controls, upload zone, conflict modal
│   ├── context/               # AuthContext & ThemeContext
│   ├── lib/                   # API client & AutosaveEngine
│   ├── pages/                 # Landing, Auth, Dashboard, FormWorkspace, Admin Console
│   └── types/                 # Shared frontend TypeScript definitions
├── tests/                     # Vitest + Supertest integration & autosave engine tests
├── docs/API.md                # REST API reference
└── storage/uploads/           # Private file storage outside public web root
```

## Key Features

1. **Advanced Autosave Engine**:
   - Automatic save **800ms** after typing pauses, plus immediate save on field blur, a pre-debounce local recovery buffer (`localStorage`), and `beforeunload` unsaved-changes protection.
   - Live save state indicators (`Unsaved changes`, `Saving...`, `All changes saved`, `Save failed`, `Retrying`, `Editing conflict detected`).
   - Automatic retries with **exponential backoff** (`2s → 4s → 8s → 16s → 30s`) and online/offline browser event recovery.
   - Optimistic concurrency (`baseVersion`) preventing stale updates or out-of-order overwrites.
   - Multi-tab detection via `BroadcastChannel` (with `localStorage` storage-event fallback) and side-by-side **Conflict Resolution Modal**.
   - Shareable draft recovery links (`/recover/:shareToken`) scoped strictly to the owning account.
2. **Modular 5-Step Application Form**:
   - Step 1: Personal Information
   - Step 2: Address Information
   - Step 3: Education & Professional Background
   - Step 4: Additional Information & Supporting Documents
   - Step 5: Review & Submit (with per-section editing and duplicate-submission lock)
3. **Secure Document Uploads**:
   - Supports `PDF`, `JPG`, `JPEG`, `PNG`, `DOC`, and `DOCX` up to 10 MB.
   - Validates extension, MIME type, and binary file magic bytes on the server.
   - Stores files outside public web directories with authorized download streaming.
4. **Authentication & Role-Based Administration**:
   - Registration, login, logout, profile updates, and password reset tokens (with documented local dev preview link when SMTP is unconfigured).
   - First-run **Initial Administrator Setup** flow in `/admin/login` (no hardcoded admin credentials).
   - Admin analytics, user directory search, submission filtering, document inspection, and auditable status transitions (`Submitted`, `Under Review`, `Approved`, `Rejected`).

## Installation & Local Startup

### Prerequisites
- **Node.js v22.5+** (uses native `node:sqlite`)
- **npm 10+**

### Setup Steps

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment variables (optional; sensible dev defaults apply)
cp .env.example .env

# 3. Start the full-stack development server (port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production Build & Start

Use `npm ci` to install the exact dependency tree recorded in `package-lock.json`.

The production build creates the Vite client in `dist/` and compiles the TypeScript server to `dist-server/server.js` with esbuild. Node built-ins (including `node:sqlite`) remain external and are provided by Node.js 22.

```bash
npm run build
NODE_ENV=production npm start
```

The Express 4 SPA fallback serves `index.html` for frontend routes while leaving `/api/*` requests to the API router. The server periodically prunes expired sessions/reset tokens and abandoned upload files older than 24 hours; the cleanup timer is stopped during graceful shutdown.

### Type Checking & Automated Tests

```bash
# TypeScript check
npm run lint

# Run Vitest + Supertest integration & autosave unit tests
npm test
```

## Initial Administrator Setup

Navigate to `/admin/login`. If no administrator account exists in the database yet, the portal presents a one-time **Initial Administrator Setup** form. Once created, the setup route permanently locks. In production, `ADMIN_SETUP_PASSCODE` is mandatory and must be set before the first administrator can be initialized. In development, the passcode remains optional.

## Security & Production-Readiness Notes

- **Database & Concurrency**: Uses embedded SQLite (`node:sqlite` with WAL mode), ideal for single-node deployments and local production instances. Multi-region or horizontally scaled deployments would require migrating to a shared PostgreSQL database.
- **File Storage**: Uploaded files are validated by extension, MIME type, and magic-byte header, then stored outside the public web root in `UPLOAD_DIR` (`./storage/uploads`). Horizontal scaling requires shared object storage (e.g., S3 or GCS).
- **Rate Limiting**: Auth endpoints use an in-memory sliding-window rate limiter; multi-instance clusters should back this with Redis.
- **Password Reset Email Delivery**: In `development` mode, `/api/auth/forgot-password` returns a `devResetPath` convenience link in the UI. In `NODE_ENV=production`, `devResetPath` is suppressed—configure a transactional email provider (SMTP/SES/Resend) before enabling public password resets in production.
- **Environment Secrets**: Set a strong random `ADMIN_SETUP_PASSCODE` before production administrator initialization. Sessions use cryptographically random opaque tokens stored as SHA-256 hashes in SQLite.

## Verifying & Extracting the ZIP Archive

```bash
# Test archive integrity
python3 -m zipfile -t autosave-form-management-system.zip

# Extract archive into a clean directory
python3 -m zipfile -e autosave-form-management-system.zip ./extracted-project
```

### Editing a submitted application

Applicants can open one of their submitted application details and choose **Edit Application**. The original draft is temporarily reopened for the owner, and the existing autosave/versioning workflow records edits. Choosing **Save Revised Application** updates the existing submission, keeps its reference code, and adds a revision entry to status history rather than creating a second submission.
