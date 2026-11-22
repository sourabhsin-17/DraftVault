import type { FormStepConfig } from '../types';

const FALLBACK_FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Legal Name',
  email: 'Email Address',
  phone: 'Phone Number',
  dateOfBirth: 'Date of Birth',
  preferredPronouns: 'Preferred Salutation / Title',
  country: 'Country',
  state: 'State / Province / Region',
  city: 'City',
  postalCode: 'Postal / ZIP Code',
  streetAddress: 'Complete Street Address',
  educationLevel: 'Highest Education Level',
  currentStatus: 'Current Professional Status',
  institutionName: 'Institution or Organization Name',
  specialization: 'Course, Major, or Specialization',
  yearsExperience: 'Years of Relevant Experience',
  applicationCategory: 'Application Track',
  availabilityDate: 'Earliest Start / Availability Date',
  statementOfPurpose: 'Project Summary or Statement of Purpose',
  additionalDetails: 'Additional Notes or Accommodations',
  confirmAccuracy: 'Accuracy Certification',
};

const WIDE_FIELD_KEYS = new Set([
  'streetAddress',
  'statementOfPurpose',
  'additionalDetails',
  'yearsExperience',
  'confirmAccuracy',
]);

export function buildFieldLabelMap(steps?: FormStepConfig[]): Record<string, string> {
  const map: Record<string, string> = { ...FALLBACK_FIELD_LABELS };
  if (!steps) return map;
  for (const step of steps) {
    for (const field of step.fields) {
      map[field.name] = field.label;
    }
  }
  return map;
}

export function getFieldLabel(key: string, labelMap?: Record<string, string>): string {
  if (labelMap && labelMap[key]) return labelMap[key];
  if (FALLBACK_FIELD_LABELS[key]) return FALLBACK_FIELD_LABELS[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (ch) => ch.toUpperCase());
}

export function isWideFieldKey(key: string): boolean {
  return WIDE_FIELD_KEYS.has(key);
}

export function formatFieldValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Confirmed' : 'Not confirmed';
  }
  if (value === null || value === undefined) return '—';
  const str = String(value).trim();
  return str.length > 0 ? str : '—';
}
