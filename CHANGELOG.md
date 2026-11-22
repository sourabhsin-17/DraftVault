# Changelog

## [1.0.0] - 2026-11-21

### Added
- **Database & Migrations**: Relational SQLite schema (`users`, `sessions`, `password_reset_tokens`, `drafts`, `form_responses`, `draft_versions`, `uploaded_files`, `submissions`, `application_status_history`) with WAL mode, foreign keys, unique constraints, and transactional helpers.
- **Authentication & Security**: `scrypt` password hashing, HTTP-only `SameSite` session cookies, session fixation rotation, CSRF header verification, rate-limited auth endpoints, and local-dev password reset token flow.
- **Autosave Engine**: 800ms debounce, save-on-blur, exponential backoff retries (2s to 30s), out-of-order response protection, `BroadcastChannel` multi-tab detection, and side-by-side optimistic concurrency conflict resolution.
- **Multi-Step Application Form**: Configurable 5-step schema with per-step server validation, last-step restoration, section-edit review screen, and atomic duplicate-submission prevention.
- **Secure Document Uploads**: Drag-and-drop multi-file uploader with progress tracking, replace/retry/delete controls, server magic-byte validation, private non-public storage, and authorized download streaming.
- **Dashboards**: Applicant dashboard (KPIs, draft CRUD, recovery links, profile editor, submission tracking) and Administrator console (first-run bootstrap, analytics, user search, submission filtering, status audit workflow).
- **Automated Tests & Docs**: Full Vitest + Supertest API security/concurrency suite, AutosaveEngine timer/retry unit tests, `README.md`, and `docs/API.md`.


## Final hardening and production packaging

- Added a two-part production build: Vite client assets in `dist/` and an esbuild-compiled ESM server in `dist-server/server.js`.
- Changed `npm start` to execute the compiled JavaScript and replaced the Express 5-style wildcard with an Express 4-compatible SPA fallback.
- Required `ADMIN_SETUP_PASSCODE` for first-administrator initialization in production.
- Added age-gated cleanup for abandoned temporary/orphaned uploads (24-hour grace period) and hourly cleanup of expired sessions and password-reset tokens, with graceful shutdown handling.
- Removed the unused `SESSION_SECRET` setting; sessions use random opaque tokens stored as SHA-256 hashes rather than signed cookies.
- Added an npm lockfile and aligned esbuild with Vite 8's optional peer dependency range.

## Unreleased — Post-submission editing

- Added an owner-only **Edit Application** action to submitted application details.
- Reopens the original application as an editable draft while retaining its application reference code.
- Uses the existing autosave and optimistic-concurrency workflow while the applicant makes revisions.
- Resubmission updates the existing submission record and records a revision event in application status history; it does not create a duplicate application.
- Each edit/save continues to create draft version snapshots.
