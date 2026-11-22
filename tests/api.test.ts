import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { clearRateLimitBuckets } from '../server/middleware/rateLimit.ts';

let tempDir: string;
let dbPath: string;
let uploadDir: string;

function makeValidStepData(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Jordan Alex Mercer',
    email: 'jordan@example.org',
    phone: '+15552345678',
    dateOfBirth: '1994-06-15',
    preferredPronouns: 'Mx.',
    country: 'United States',
    state: 'California',
    city: 'San Francisco',
    postalCode: '94107',
    streetAddress: '500 Howard Street, Suite 400',
    educationLevel: "Master's Degree",
    currentStatus: 'Full-Time Employed',
    institutionName: 'UC Berkeley',
    specialization: 'Distributed Systems',
    yearsExperience: '5-9',
    applicationCategory: 'Research & Innovation Grant',
    availabilityDate: '2026-09-01',
    statementOfPurpose:
      'Developing resilient distributed form state synchronization with deterministic conflict resolution.',
    additionalDetails: 'Available for remote and hybrid collaboration.',
    confirmAccuracy: true,
    ...overrides,
  };
}

describe('Autosave Form Management System - Full-Stack API & Security Suite', () => {
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'afms-test-'));
    dbPath = path.join(tempDir, 'test.db');
    uploadDir = path.join(tempDir, 'uploads');
    process.env.DATABASE_PATH = dbPath;
    process.env.UPLOAD_DIR = uploadDir;
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearRateLimitBuckets();
  });

  function setupFreshServer(options?: { disableRateLimit?: boolean }) {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    const { app } = createApp({
      db,
      disableRateLimit: options?.disableRateLimit ?? true,
    });
    return { app, db };
  }

  it('registers, enforces duplicate email & password policy, rotates session cookies, updates profile, logs out, and blocks protected routes', async () => {
    const { app, db } = setupFreshServer();
    try {
      const unauth = await request(app).get('/api/drafts');
      expect(unauth.status).toBe(401);

      const weak = await request(app).post('/api/auth/register').send({
        fullName: 'Alice Example',
        email: 'alice@example.com',
        password: 'weak',
        confirmPassword: 'weak',
      });
      expect(weak.status).toBe(400);

      const agent = request.agent(app);
      const reg = await agent.post('/api/auth/register').send({
        fullName: 'Alice Example',
        email: 'alice@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(reg.status).toBe(201);
      expect(reg.body.data.user.email).toBe('alice@example.com');
      expect(reg.body.data.csrfToken).toBeTruthy();
      expect(reg.headers['set-cookie']?.[0]).toContain('HttpOnly');

      // Verify user exists in SQLite database
      const userRow = db
        .prepare('SELECT email, role, password_hash FROM users WHERE email = ?')
        .get('alice@example.com') as { email: string; role: string; password_hash: string };
      expect(userRow.email).toBe('alice@example.com');
      expect(userRow.password_hash.startsWith('scrypt:')).toBe(true);

      // Duplicate email rejected
      const dup = await request(app).post('/api/auth/register').send({
        fullName: 'Alice Clone',
        email: 'alice@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(dup.status).toBe(409);

      // Mutating request without CSRF token rejected
      const noCsrf = await agent.post('/api/drafts').send({ title: 'Should Fail' });
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.error.code).toBe('INVALID_CSRF_TOKEN');

      // Session fixation protection: re-login issues a brand new cookie token
      const firstCookie = reg.headers['set-cookie']?.[0];
      const relogin = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', reg.body.data.csrfToken)
        .send({
          email: 'alice@example.com',
          password: 'Password123',
        });
      expect(relogin.status).toBe(200);
      const csrfToken = relogin.body.data.csrfToken;
      const secondCookie = relogin.headers['set-cookie']?.[0];
      expect(secondCookie).toBeTruthy();
      expect(secondCookie).not.toBe(firstCookie);

      // Update profile
      const profileUpdate = await agent
        .patch('/api/auth/profile')
        .set('X-CSRF-Token', csrfToken)
        .send({ fullName: 'Alice Updated', phone: '+15550001111', bio: 'Research Fellow' });
      expect(profileUpdate.status).toBe(200);
      expect(profileUpdate.body.data.user.fullName).toBe('Alice Updated');

      // Logout clears session in DB and blocks subsequent protected calls
      const logoutRes = await agent
        .post('/api/auth/logout')
        .set('X-CSRF-Token', csrfToken);
      expect(logoutRes.status).toBe(200);
      const afterLogout = await agent.get('/api/drafts');
      expect(afterLogout.status).toBe(401);
    } finally {
      db.close();
    }
  });

  it('enforces login rate limiting and supports genuine forgot/reset password flow with session revocation', async () => {
    const { app, db } = setupFreshServer({ disableRateLimit: false });
    try {
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Bob Tester',
        email: 'bob@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(reg.status).toBe(201);

      const agent = request.agent(app);
      const loginOk = await agent.post('/api/auth/login').send({
        email: 'bob@example.com',
        password: 'Password123',
      });
      expect(loginOk.status).toBe(200);

      const forgot = await request(app).post('/api/auth/forgot-password').send({
        email: 'bob@example.com',
      });
      expect(forgot.status).toBe(200);
      expect(forgot.body.data.devResetToken).toBeTruthy();

      const reset = await request(app).post('/api/auth/reset-password').send({
        token: forgot.body.data.devResetToken,
        password: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });
      expect(reset.status).toBe(200);

      const meAfterReset = await agent.get('/api/auth/me');
      expect(meAfterReset.body.data.user).toBeNull();

      const badOld = await request(app).post('/api/auth/login').send({
        email: 'bob@example.com',
        password: 'Password123',
      });
      expect(badOld.status).toBe(401);

      let hit429 = false;
      for (let i = 0; i < 30; i++) {
        const attempt = await request(app).post('/api/auth/login').send({
          email: 'bob@example.com',
          password: 'WrongPassword1',
        });
        if (attempt.status === 429) {
          hit429 = true;
          break;
        }
      }
      expect(hit429).toBe(true);
    } finally {
      db.close();
    }
  });

  it('supports full 5-step navigation, draft rename/delete, user isolation, shareable recovery, optimistic concurrency, and conflict resolution', async () => {
    const { app, db } = setupFreshServer();
    try {
      const userA = request.agent(app);
      const regA = await userA.post('/api/auth/register').send({
        fullName: 'User A',
        email: 'usera@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      const csrfA = regA.body.data.csrfToken;

      const userB = request.agent(app);
      const regB = await userB.post('/api/auth/register').send({
        fullName: 'User B',
        email: 'userb@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      const csrfB = regB.body.data.csrfToken;

      // Form config returns 5 steps
      const configRes = await userA.get('/api/forms/config');
      expect(configRes.status).toBe(200);
      expect(configRes.body.data.totalSteps).toBe(5);

      // User A creates draft & renames it
      const created = await userA
        .post('/api/drafts')
        .set('X-CSRF-Token', csrfA)
        .send({ title: 'Grant Proposal 2026' });
      expect(created.status).toBe(201);
      const draftId = created.body.data.draft.id;
      const shareToken = created.body.data.draft.shareToken;

      const renamed = await userA
        .patch(`/api/drafts/${draftId}/rename`)
        .set('X-CSRF-Token', csrfA)
        .send({ title: 'Renamed Grant Proposal' });
      expect(renamed.status).toBe(200);
      expect(renamed.body.data.draft.title).toBe('Renamed Grant Proposal');

      // User B cannot access, update, recover, rename, or delete User A's draft
      expect((await userB.get(`/api/drafts/${draftId}`)).status).toBe(403);
      expect((await userB.get(`/api/drafts/recover/${shareToken}`)).status).toBe(403);
      expect(
        (
          await userB
            .put(`/api/drafts/${draftId}`)
            .set('X-CSRF-Token', csrfB)
            .send({ baseVersion: 1, currentStep: 1, data: { fullName: 'Hijacked' } })
        ).status
      ).toBe(403);
      expect(
        (await userB.delete(`/api/drafts/${draftId}`).set('X-CSRF-Token', csrfB)).status
      ).toBe(403);

      // User A walks through steps 1 -> 2 -> 3 -> 4 -> 5 via save-step
      const fullData = makeValidStepData();
      let currentVer = renamed.body.data.draft.version;
      for (const step of [1, 2, 3, 4]) {
        const stepSave = await userA
          .post(`/api/forms/${draftId}/save-step`)
          .set('X-CSRF-Token', csrfA)
          .send({
            stepNumber: step,
            baseVersion: currentVer,
            nextStep: step + 1,
            data: fullData,
            completedSteps: Array.from({ length: step }, (_, i) => i + 1),
          });
        expect(stepSave.status).toBe(200);
        currentVer = stepSave.body.data.draft.version;
        expect(stepSave.body.data.draft.currentStep).toBe(step + 1);
      }

      // Draft recovery after simulated browser refresh restores step 5 & entered data
      const recovered = await userA.get(`/api/drafts/recover/${shareToken}`);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data.draft.currentStep).toBe(5);
      expect(recovered.body.data.draft.data.institutionName).toBe('UC Berkeley');

      // Simulate Tab 1 save vs Tab 2 stale save -> 409 VERSION_CONFLICT
      const saveTab1 = await userA
        .put(`/api/drafts/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .send({
          baseVersion: currentVer,
          currentStep: 5,
          data: { ...fullData, fullName: 'Jordan Tab 1' },
          tabId: 'tab-1',
        });
      expect(saveTab1.status).toBe(200);
      const newerServerVer = saveTab1.body.data.draft.version;

      const staleSaveTab2 = await userA
        .put(`/api/drafts/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .send({
          baseVersion: currentVer,
          currentStep: 5,
          data: { ...fullData, fullName: 'Jordan Tab 2' },
          tabId: 'tab-2',
        });
      expect(staleSaveTab2.status).toBe(409);
      expect(staleSaveTab2.body.error.code).toBe('VERSION_CONFLICT');
      expect(staleSaveTab2.body.error.details.serverVersion).toBe(newerServerVer);

      // Conflict resolution: keep_local advances version cleanly
      const resolved = await userA
        .post(`/api/drafts/${draftId}/resolve-conflict`)
        .set('X-CSRF-Token', csrfA)
        .send({
          resolution: 'keep_local',
          expectedServerVersion: newerServerVer,
          currentStep: 5,
          data: { ...fullData, fullName: 'Jordan Resolved' },
          tabId: 'tab-2',
        });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data.draft.version).toBe(newerServerVer + 1);
      expect(resolved.body.data.draft.data.fullName).toBe('Jordan Resolved');

      // Creating and deleting a disposable draft cleans it from DB
      const tempDraft = await userA
        .post('/api/drafts')
        .set('X-CSRF-Token', csrfA)
        .send({ title: 'Disposable Draft' });
      const tempDraftId = tempDraft.body.data.draft.id;
      const delRes = await userA
        .delete(`/api/drafts/${tempDraftId}`)
        .set('X-CSRF-Token', csrfA);
      expect(delRes.status).toBe(200);
      expect((await userA.get(`/api/drafts/${tempDraftId}`)).status).toBe(404);
    } finally {
      db.close();
    }
  });

  it('validates uploaded files via magic bytes, handles file replace & delete, blocks unauthorized access, handles submission & duplicate protection, and enforces admin RBAC', async () => {
    const { app, db } = setupFreshServer();
    try {
      const userA = request.agent(app);
      const regA = await userA.post('/api/auth/register').send({
        fullName: 'Applicant A',
        email: 'applicanta@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      const csrfA = regA.body.data.csrfToken;

      const userB = request.agent(app);
      await userB.post('/api/auth/register').send({
        fullName: 'Applicant B',
        email: 'applicantb@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

      const draftRes = await userA
        .post('/api/drafts')
        .set('X-CSRF-Token', csrfA)
        .send({ title: 'Fellowship Application' });
      const draftId = draftRes.body.data.draft.id;

      // 1. Reject spoofed PDF (invalid magic bytes)
      const spoofedPdf = await userA
        .post(`/api/uploads/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .attach('files', Buffer.from('NOT_A_REAL_PDF_SCRIPT'), {
          filename: 'malicious.pdf',
          contentType: 'application/pdf',
        });
      expect(spoofedPdf.status).toBe(400);
      expect(spoofedPdf.body.error.code).toBe('INVALID_FILE_SIGNATURE');

      // 2. Reject unsupported extension (.exe)
      const badExt = await userA
        .post(`/api/uploads/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .attach('files', Buffer.from('MZ12345'), {
          filename: 'payload.exe',
          contentType: 'application/octet-stream',
        });
      expect(badExt.status).toBe(400);

      // 3. Accept valid PNG & PDF signatures
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const validPng = await userA
        .post(`/api/uploads/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .attach('files', pngBytes, {
          filename: 'id_card.png',
          contentType: 'image/png',
        });
      expect(validPng.status).toBe(201);
      const oldFileId = validPng.body.data.files[0].id;

      // 4. Replace uploaded file with a valid PDF
      const replacedPdf = await userA
        .post(`/api/uploads/${draftId}`)
        .set('X-CSRF-Token', csrfA)
        .field('replaceFileId', oldFileId)
        .attach('files', Buffer.from('%PDF-1.4\n%Replaced Transcript'), {
          filename: 'transcript_v2.pdf',
          contentType: 'application/pdf',
        });
      expect(replacedPdf.status).toBe(201);
      const fileId = replacedPdf.body.data.files[0].id;

      const listFiles = await userA.get(`/api/uploads/${draftId}`);
      expect(listFiles.body.data.files).toHaveLength(1);
      expect(listFiles.body.data.files[0].originalName).toBe('transcript_v2.pdf');

      // 5. User B cannot list or download User A's file
      expect((await userB.get(`/api/uploads/${draftId}`)).status).toBe(403);
      expect((await userB.get(`/api/uploads/file/${fileId}/download`)).status).toBe(403);

      // 6. User A can download their file
      const ownerDownload = await userA.get(`/api/uploads/file/${fileId}/download`);
      expect(ownerDownload.status).toBe(200);

      // 7. Submit application
      const fullData = makeValidStepData();
      const submit1 = await userA
        .post('/api/forms/submit')
        .set('X-CSRF-Token', csrfA)
        .send({ draftId, data: fullData });
      expect(submit1.status).toBe(201);
      const submissionId = submit1.body.data.submission.id;
      expect(submit1.body.data.submission.referenceCode).toMatch(/^APP-\d{4}-/);

      // 8. Duplicate submission rejected with 409
      const submit2 = await userA
        .post('/api/forms/submit')
        .set('X-CSRF-Token', csrfA)
        .send({ draftId, data: fullData });
      expect(submit2.status).toBe(409);
      expect(submit2.body.error.code).toBe('DUPLICATE_SUBMISSION');

      // 9. Ordinary user blocked from admin routes (403)
      expect((await userA.get('/api/admin/stats')).status).toBe(403);

      // 10. Admin bootstrap works once and locks permanently afterward
      const statusBefore = await request(app).get('/api/auth/admin/bootstrap-status');
      expect(statusBefore.body.data.needsBootstrap).toBe(true);

      const adminAgent = request.agent(app);
      const adminBoot = await adminAgent.post('/api/auth/admin/bootstrap').send({
        fullName: 'Chief Admin',
        email: 'admin@example.com',
        password: 'AdminPassword123',
        confirmPassword: 'AdminPassword123',
      });
      expect(adminBoot.status).toBe(201);
      const adminCsrf = adminBoot.body.data.csrfToken;

      const secondBoot = await request(app).post('/api/auth/admin/bootstrap').send({
        fullName: 'Rogue Admin',
        email: 'rogue@example.com',
        password: 'AdminPassword123',
        confirmPassword: 'AdminPassword123',
      });
      expect(secondBoot.status).toBe(403);

      // 11. Admin searches users, filters submissions, downloads document, and updates status
      const usersList = await adminAgent.get('/api/admin/users?search=applicanta');
      expect(usersList.status).toBe(200);
      expect(usersList.body.data.users).toHaveLength(1);

      const subFilter = await adminAgent.get('/api/admin/submissions?status=Submitted');
      expect(subFilter.status).toBe(200);
      expect(subFilter.body.data.submissions).toHaveLength(1);

      const adminDownload = await adminAgent.get(`/api/uploads/file/${fileId}/download`);
      expect(adminDownload.status).toBe(200);

      const statusUpdate = await adminAgent
        .patch(`/api/admin/submissions/${submissionId}/status`)
        .set('X-CSRF-Token', adminCsrf)
        .send({ status: 'Approved', note: 'All verification documents passed.' });
      expect(statusUpdate.status).toBe(200);
      expect(statusUpdate.body.data.submission.status).toBe('Approved');
      expect(statusUpdate.body.data.submission.statusHistory).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});
