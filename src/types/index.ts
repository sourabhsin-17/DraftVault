export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'checkbox' | 'file';

export interface FormFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: { label: string; value: string }[];
  colSpan?: 1 | 2;
  maxLength?: number;
}

export interface FormStepConfig {
  stepNumber: number;
  key: string;
  title: string;
  subtitle: string;
  fields: FormFieldConfig[];
  isReviewStep?: boolean;
}

export interface FormConfigResponse {
  formId: string;
  title: string;
  totalSteps: number;
  steps: FormStepConfig[];
}

export interface UploadedFileRecord {
  id: string;
  draftId: string;
  stepKey?: string;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DraftVersionEntry {
  id: string;
  version: number;
  currentStep: number;
  savedByTabId: string;
  changeSummary: string;
  createdAt: string;
}

export interface DraftSummary {
  id: string;
  userId: string;
  title: string;
  formType: string;
  currentStep: number;
  version: number;
  shareToken: string;
  status: 'Draft' | 'Submitted';
  lastClientTabId: string;
  fileCount: number;
  completedSteps: number[];
  applicantName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftDetail extends DraftSummary {
  data: Record<string, unknown>;
  files: UploadedFileRecord[];
  versions: DraftVersionEntry[];
}

export type SubmissionStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';

export interface SubmissionSummary {
  id: string;
  referenceCode: string;
  draftId: string;
  userId: string;
  title: string;
  applicantName: string;
  applicantEmail: string;
  status: SubmissionStatus;
  fileCount?: number;
  submittedAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  note: string;
  changedByName: string;
  changedByRole: string;
  createdAt: string;
}

export interface SubmissionDetail extends SubmissionSummary {
  adminNotes: string;
  formData: Record<string, unknown>;
  files: UploadedFileRecord[];
  statusHistory: StatusHistoryEntry[];
}

export interface ConflictPayload {
  serverVersion: number;
  serverCurrentStep: number;
  serverUpdatedAt: string;
  serverLastTabId: string;
  serverData: Record<string, unknown>;
  serverCompletedSteps: number[];
}

export interface AdminStats {
  totalUsers: number;
  activeDrafts: number;
  totalSubmissions: number;
  totalFiles: number;
  totalStorageBytes: number;
  statusBreakdown: Record<SubmissionStatus, number>;
  recentSubmissions: {
    id: string;
    referenceCode: string;
    title: string;
    applicantName: string;
    applicantEmail: string;
    status: SubmissionStatus;
    submittedAt: string;
  }[];
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string;
  draftCount: number;
  submissionCount: number;
  createdAt: string;
}
