import { z } from 'zod';

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

export const APPLICATION_FORM_STEPS: FormStepConfig[] = [
  {
    stepNumber: 1,
    key: 'personal',
    title: 'Personal Information',
    subtitle: 'Primary applicant contact details and legal identification.',
    fields: [
      {
        name: 'fullName',
        label: 'Full Legal Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Jordan Alex Mercer',
        colSpan: 2,
        maxLength: 120,
      },
      {
        name: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'applicant@organization.org',
        colSpan: 1,
        maxLength: 160,
      },
      {
        name: 'phone',
        label: 'Phone Number',
        type: 'tel',
        required: true,
        placeholder: '+1 (555) 234-5678',
        colSpan: 1,
        maxLength: 32,
      },
      {
        name: 'dateOfBirth',
        label: 'Date of Birth',
        type: 'date',
        required: true,
        colSpan: 1,
      },
      {
        name: 'preferredPronouns',
        label: 'Preferred Salutation / Title',
        type: 'select',
        required: false,
        colSpan: 1,
        options: [
          { label: 'Select (Optional)', value: '' },
          { label: 'Mr.', value: 'Mr.' },
          { label: 'Ms.', value: 'Ms.' },
          { label: 'Mx.', value: 'Mx.' },
          { label: 'Dr.', value: 'Dr.' },
          { label: 'Prof.', value: 'Prof.' },
        ],
      },
    ],
  },
  {
    stepNumber: 2,
    key: 'address',
    title: 'Address Information',
    subtitle: 'Current residential or correspondence address for official notices.',
    fields: [
      {
        name: 'country',
        label: 'Country',
        type: 'text',
        required: true,
        placeholder: 'United States',
        colSpan: 1,
        maxLength: 80,
      },
      {
        name: 'state',
        label: 'State / Province / Region',
        type: 'text',
        required: true,
        placeholder: 'California',
        colSpan: 1,
        maxLength: 80,
      },
      {
        name: 'city',
        label: 'City',
        type: 'text',
        required: true,
        placeholder: 'San Francisco',
        colSpan: 1,
        maxLength: 80,
      },
      {
        name: 'postalCode',
        label: 'Postal / ZIP Code',
        type: 'text',
        required: true,
        placeholder: '94107',
        colSpan: 1,
        maxLength: 24,
      },
      {
        name: 'streetAddress',
        label: 'Complete Street Address',
        type: 'textarea',
        required: true,
        placeholder: 'Apartment, suite, street number, and building details',
        colSpan: 2,
        maxLength: 300,
      },
    ],
  },
  {
    stepNumber: 3,
    key: 'education',
    title: 'Education & Professional Background',
    subtitle: 'Academic qualifications, training, or current professional role.',
    fields: [
      {
        name: 'educationLevel',
        label: 'Highest Education Level',
        type: 'select',
        required: true,
        colSpan: 1,
        options: [
          { label: 'Select education level', value: '' },
          { label: 'High School / Secondary', value: 'High School' },
          { label: 'Associate Degree / Diploma', value: 'Associate Degree' },
          { label: "Bachelor's Degree", value: "Bachelor's Degree" },
          { label: "Master's Degree", value: "Master's Degree" },
          { label: 'Doctorate / PhD', value: 'Doctorate' },
          { label: 'Professional Certification', value: 'Professional Certification' },
        ],
      },
      {
        name: 'currentStatus',
        label: 'Current Professional Status',
        type: 'select',
        required: true,
        colSpan: 1,
        options: [
          { label: 'Select current status', value: '' },
          { label: 'Full-Time Employed', value: 'Full-Time Employed' },
          { label: 'Part-Time Employed', value: 'Part-Time Employed' },
          { label: 'Self-Employed / Founder', value: 'Self-Employed' },
          { label: 'Full-Time Student', value: 'Student' },
          { label: 'Researcher / Fellow', value: 'Researcher' },
          { label: 'Seeking Opportunities', value: 'Seeking Opportunities' },
        ],
      },
      {
        name: 'institutionName',
        label: 'Institution or Organization Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., University of California, Berkeley',
        colSpan: 1,
        maxLength: 150,
      },
      {
        name: 'specialization',
        label: 'Course, Major, or Specialization',
        type: 'text',
        required: true,
        placeholder: 'e.g., Distributed Systems & Computer Science',
        colSpan: 1,
        maxLength: 150,
      },
      {
        name: 'yearsExperience',
        label: 'Years of Relevant Experience',
        type: 'select',
        required: false,
        colSpan: 2,
        options: [
          { label: 'Select experience range (Optional)', value: '' },
          { label: '0 - 1 years', value: '0-1' },
          { label: '2 - 4 years', value: '2-4' },
          { label: '5 - 9 years', value: '5-9' },
          { label: '10+ years', value: '10+' },
        ],
      },
    ],
  },
  {
    stepNumber: 4,
    key: 'additional',
    title: 'Additional Information & Supporting Documents',
    subtitle: 'Statement of purpose, supplemental context, and verified supporting files.',
    fields: [
      {
        name: 'applicationCategory',
        label: 'Application Track',
        type: 'select',
        required: true,
        colSpan: 1,
        options: [
          { label: 'Select application track', value: '' },
          { label: 'Research & Innovation Grant', value: 'Research & Innovation Grant' },
          { label: 'Graduate Fellowship Program', value: 'Graduate Fellowship Program' },
          { label: 'Enterprise Partner Onboarding', value: 'Enterprise Partner Onboarding' },
          { label: 'Professional Accreditation', value: 'Professional Accreditation' },
        ],
      },
      {
        name: 'availabilityDate',
        label: 'Earliest Start / Availability Date',
        type: 'date',
        required: false,
        colSpan: 1,
      },
      {
        name: 'statementOfPurpose',
        label: 'Project Summary or Statement of Purpose',
        type: 'textarea',
        required: true,
        placeholder: 'Describe your objectives, relevant background, and expected outcomes (minimum 30 characters).',
        helperText: 'Autosaves automatically 800ms after you pause typing.',
        colSpan: 2,
        maxLength: 3000,
      },
      {
        name: 'additionalDetails',
        label: 'Additional Notes or Accommodations',
        type: 'textarea',
        required: false,
        placeholder: 'Include any links, references, or special considerations (optional).',
        colSpan: 2,
        maxLength: 1500,
      },
      {
        name: 'supportingDocuments',
        label: 'Supporting Documents (PDF, JPG, PNG, DOC, DOCX)',
        type: 'file',
        required: false,
        helperText: 'Upload transcripts, identification, resumes, or signed forms. Max 10 MB per file.',
        colSpan: 2,
      },
    ],
  },
  {
    stepNumber: 5,
    key: 'review',
    title: 'Review & Submit',
    subtitle: 'Verify all entered sections and supporting documents prior to final submission.',
    isReviewStep: true,
    fields: [
      {
        name: 'confirmAccuracy',
        label: 'I certify that all information and uploaded documents provided in this application are accurate and complete.',
        type: 'checkbox',
        required: true,
        colSpan: 2,
      },
    ],
  },
];

export const step1Schema = z.object({
  fullName: z.string().trim().min(2, 'Full legal name must be at least 2 characters').max(120),
  email: z.string().trim().email('Please enter a valid email address').max(160),
  phone: z.string().trim().min(7, 'Please enter a valid phone number').max(32),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is required (YYYY-MM-DD)'),
  preferredPronouns: z.string().trim().max(30).optional().default(''),
});

export const step2Schema = z.object({
  country: z.string().trim().min(2, 'Country is required').max(80),
  state: z.string().trim().min(2, 'State or region is required').max(80),
  city: z.string().trim().min(2, 'City is required').max(80),
  postalCode: z.string().trim().min(3, 'Postal code is required').max(24),
  streetAddress: z.string().trim().min(5, 'Complete street address is required').max(300),
});

export const step3Schema = z.object({
  educationLevel: z.string().trim().min(2, 'Please select your highest education level').max(80),
  currentStatus: z.string().trim().min(2, 'Please select your current professional status').max(80),
  institutionName: z.string().trim().min(2, 'Institution or organization name is required').max(150),
  specialization: z.string().trim().min(2, 'Course or specialization is required').max(150),
  yearsExperience: z.string().trim().max(20).optional().default(''),
});

export const step4Schema = z.object({
  applicationCategory: z.string().trim().min(2, 'Please select an application track').max(100),
  availabilityDate: z.string().trim().max(20).optional().default(''),
  statementOfPurpose: z.string().trim().min(30, 'Please provide at least 30 characters in your summary').max(3000),
  additionalDetails: z.string().trim().max(1500).optional().default(''),
});

export const step5Schema = z.object({
  confirmAccuracy: z.literal(true, {
    message: 'You must confirm accuracy before submitting',
  }),
});

export const fullApplicationSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema);

export function validateStepData(stepNumber: number, data: Record<string, unknown>) {
  switch (stepNumber) {
    case 1:
      return step1Schema.safeParse(data);
    case 2:
      return step2Schema.safeParse(data);
    case 3:
      return step3Schema.safeParse(data);
    case 4:
      return step4Schema.safeParse(data);
    case 5:
      return fullApplicationSchema.safeParse(data);
    default:
      return null;
  }
}
