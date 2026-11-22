# REST API Documentation

All responses follow a consistent JSON envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message", "details": {} } }
```

State-changing authenticated requests (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-CSRF-Token` header returned from `/api/auth/me`, `/api/auth/login`, or `/api/auth/register`.

---

## Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new applicant account and issue HTTP-only session cookie. |
| `POST` | `/api/auth/login` | Public | Authenticate user, rotate session ID, and issue cookie + CSRF token. |
| `POST` | `/api/auth/logout` | Session | Revoke active session in DB and clear cookie. |
| `GET` | `/api/auth/me` | Optional | Return current user and CSRF token (or `null` when signed out). |
| `PATCH` | `/api/auth/profile` | User | Update `fullName`, `phone`, and `bio`. |
| `POST` | `/api/auth/forgot-password` | Public | Generate 30-min reset token (returns dev preview link in non-prod). |
| `POST` | `/api/auth/reset-password` | Public | Validate reset token, update password, and revoke all user sessions. |
| `GET` | `/api/auth/admin/bootstrap-status` | Public | Check if initial administrator setup is required. |
| `POST` | `/api/auth/admin/bootstrap` | Public (One-time) | Atomically create initial admin account when zero admins exist. |
| `POST` | `/api/auth/admin/login` | Public | Authenticate administrator account (`role === 'admin'`). |

---

## Drafts & Autosave Concurrency (`/api/drafts`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/drafts` | User | Create a new draft (`version = 1`, `currentStep = 1`, unique `shareToken`). |
| `GET` | `/api/drafts` | User | List drafts belonging to the authenticated user. |
| `GET` | `/api/drafts/:id` | Owner | Fetch draft detail, form responses, attached files, and version history. |
| `GET` | `/api/drafts/recover/:shareToken` | Owner | Recover a draft using its shareable token (enforces owner isolation). |
| `PUT` | `/api/drafts/:id` | Owner | Autosave draft with `baseVersion` optimistic concurrency check. Returns `409 VERSION_CONFLICT` with latest server snapshot if stale. |
| `PATCH` | `/api/drafts/:id/rename` | Owner | Update draft title. |
| `DELETE` | `/api/drafts/:id` | Owner | Delete an unsubmitted draft and its physical uploaded files. |
| `POST` | `/api/drafts/:id/resolve-conflict` | Owner | Resolve version conflict (`use_server` or `keep_local`). |

---

## Multi-Step Forms & Submissions (`/api/forms`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/forms/config` | Public | Retrieve modular 5-step application schema. |
| `POST` | `/api/forms/validate-step` | User | Validate fields for a specific step (`1–5`). |
| `POST` | `/api/forms/:draftId/save-step` | Owner | Validate step, mark step completed, advance `currentStep`, and bump draft version. |
| `POST` | `/api/forms/submit` | Owner | Validate full application, lock draft, prevent duplicate submission (`409`), and create submission record. |
| `GET` | `/api/forms/submissions` | User | List authenticated user's submitted applications. |
| `GET` | `/api/forms/submissions/:id` | Owner/Admin | Fetch full submission snapshot, files, and status audit history. |

---

## Document Uploads (`/api/uploads`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/uploads/:draftId` | Owner | Upload up to 5 files (`PDF`, `JPG`, `JPEG`, `PNG`, `DOC`, `DOCX`, max 10 MB each) with magic-byte verification. Supports `replaceFileId`. |
| `GET` | `/api/uploads/:draftId` | Owner/Admin | List uploaded documents attached to a draft. |
| `DELETE` | `/api/uploads/file/:fileId` | Owner | Remove an uploaded document from an unsubmitted draft and disk. |
| `GET` | `/api/uploads/file/:fileId/download` | Owner/Admin | Stream authorized document with `X-Content-Type-Options: nosniff`. |

---

## Administrator Operations (`/api/admin`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | Retrieve aggregate counts, storage usage, status breakdown, and recent submissions. |
| `GET` | `/api/admin/users` | Admin | List and search registered users with draft/submission counts. |
| `GET` | `/api/admin/submissions` | Admin | List, search, and filter submitted applications by status. |
| `GET` | `/api/admin/submissions/:id` | Admin | View full submission detail, documents, and audit history. |
| `PATCH` | `/api/admin/submissions/:id/status` | Admin | Update application status (`Submitted`, `Under Review`, `Approved`, `Rejected`) and append audit history note. |
