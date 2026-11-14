export type Tab = 'overview' | 'doctors' | 'departments' | 'services' | 'appointments' | 'documents' | 'settings'

export const HOSPITAL_ROLES = ['owner', 'medical_director', 'department_head', 'consultant', 'resident', 'intern', 'staff', 'visiting']
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'visiting', 'contract', 'honorary']
export const SERVICE_CATEGORIES = ['consultation', 'surgery', 'diagnostics', 'dentistry', 'pharmacy', 'grooming',
  'vaccination', 'emergency', 'radiology', 'laboratory', 'physiotherapy', 'ophthalmology']

export const HOSPITAL_TYPE_LABELS: Record<string, string> = {
  clinic:           'General Practice',
  emergency_center: 'Emergency & Trauma',
  specialty:        'Specialty',
  multi_specialty:  'Multi-Specialty',
  teaching:         'Teaching Hospital',
  research:         'Research Centre',
  mobile_vet:       'Mobile Unit',
  other:            'Other / Shelter Clinic',
}

export function getVerificationStatusInfo(requiredDocCount: number): Record<string, { label: string; className: string; msg: string }> { return {
  pending_documents: {
    label: 'Pending Documents',
    className: 'vstatus-pending',
    msg: `Please upload all ${requiredDocCount} required compliance documents to submit for verification.`,
  },
  under_review: {
    label: 'Under Review',
    className: 'vstatus-review',
    msg: 'All documents have been submitted. Our team will review them within 2-3 business days.',
  },
  approved: {
    label: 'Verified & Active',
    className: 'vstatus-approved',
    msg: 'Your hospital is verified and visible to patients.',
  },
  rejected: {
    label: 'Action Required',
    className: 'vstatus-rejected',
    msg: 'One or more documents were rejected. Please re-upload the corrected documents.',
  },
  suspended: {
    label: 'Suspended - Expired Documents',
    className: 'vstatus-suspended',
    msg: 'Your hospital has been suspended due to expired documents. Please renew and re-upload.',
  },
} }
