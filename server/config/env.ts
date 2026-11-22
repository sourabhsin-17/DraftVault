import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export function getEnvConfig() {
  const cwd = process.cwd();
  const maxFileMb = Number(process.env.MAX_FILE_SIZE_MB || '10');
  const safeMaxMb = Number.isFinite(maxFileMb) && maxFileMb > 0 && maxFileMb <= 50 ? maxFileMb : 10;

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || '3000'),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    databasePath: process.env.DATABASE_PATH
      ? path.resolve(cwd, process.env.DATABASE_PATH)
      : path.resolve(cwd, 'data', 'app.db'),
    uploadDir: process.env.UPLOAD_DIR
      ? path.resolve(cwd, process.env.UPLOAD_DIR)
      : path.resolve(cwd, 'storage', 'uploads'),
    maxFileSizeBytes: safeMaxMb * 1024 * 1024,
    maxFileSizeMb: safeMaxMb,
    adminSetupPasscode: process.env.ADMIN_SETUP_PASSCODE?.trim() || '',
    sessionCookieName: 'afms_sid',
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
