import { z } from 'zod';

export const passwordPolicySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(160),
    password: passwordPolicySchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const adminBootstrapSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(160),
    password: passwordPolicySchema,
    confirmPassword: z.string(),
    setupPasscode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(16, 'Invalid reset token'),
    password: passwordPolicySchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  phone: z.string().trim().max(32).optional().default(''),
  bio: z.string().trim().max(500).optional().default(''),
});

export const createDraftSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  initialData: z.record(z.string(), z.unknown()).optional(),
});

export const renameDraftSchema = z.object({
  title: z.string().trim().min(2, 'Draft title must be at least 2 characters').max(160),
});

export const updateDraftSchema = z.object({
  baseVersion: z.number().int().min(1),
  currentStep: z.number().int().min(1).max(5),
  data: z.record(z.string(), z.unknown()),
  completedSteps: z.array(z.number().int().min(1).max(5)).optional(),
  tabId: z.string().max(100).optional(),
  clientTimestamp: z.number().optional(),
  changeSummary: z.string().max(200).optional(),
});

export const resolveConflictSchema = z.object({
  resolution: z.enum(['use_server', 'keep_local']),
  expectedServerVersion: z.number().int().min(1),
  currentStep: z.number().int().min(1).max(5).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  completedSteps: z.array(z.number().int().min(1).max(5)).optional(),
  tabId: z.string().max(100).optional(),
});

export const validateStepRequestSchema = z.object({
  stepNumber: z.number().int().min(1).max(5),
  data: z.record(z.string(), z.unknown()),
});

export const saveStepRequestSchema = z.object({
  stepNumber: z.number().int().min(1).max(5),
  baseVersion: z.number().int().min(1),
  nextStep: z.number().int().min(1).max(5).optional(),
  data: z.record(z.string(), z.unknown()),
  completedSteps: z.array(z.number().int().min(1).max(5)).optional(),
  tabId: z.string().max(100).optional(),
});

export const submitApplicationSchema = z.object({
  draftId: z.string().uuid('Invalid draft ID'),
  baseVersion: z.number().int().min(1).optional(),
  data: z.record(z.string(), z.unknown()),
});

export const updateSubmissionStatusSchema = z.object({
  status: z.enum(['Submitted', 'Under Review', 'Approved', 'Rejected']),
  note: z.string().trim().max(500).optional().default(''),
});
