export type Role = 'APPLICANT' | 'OWNER';
export type Goal = 'STUDY' | 'VOCATIONAL' | 'EMPLOYMENT';
export type Source = 'APPLICANT' | 'DOCUMENT' | 'VIDEO' | 'AI_GENERATED';
export type ApplicantStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface Tracked {
  value: string;
  source: Source;
  verified: boolean;
  documentId?: string;
}

interface Provenance {
  id: string;
  source: Source;
  verified: boolean;
  documentId?: string;
}
export interface EducationItem extends Provenance {
  institution: string;
  qualification: string;
  level: string;
  field?: string;
  graduationDate?: string;
  grade?: string;
}
export interface EmploymentItem extends Provenance {
  employer: string;
  role: string;
  responsibilities?: string;
  startDate?: string;
  endDate?: string | null;
}
export interface SkillItem extends Provenance {
  name: string;
}
export interface LanguageItem extends Provenance {
  language: string;
  level: string;
  certificate?: string;
  score?: string;
}

export interface Requirement {
  code: string;
  label: string;
  met: boolean;
  kind: 'HARD' | 'SOFT';
  detail?: string;
  action?: string;
}
export interface Issue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}
export type Outcome = 'ELIGIBLE' | 'CONDITIONALLY_ELIGIBLE' | 'NOT_YET_ELIGIBLE' | 'INSUFFICIENT_INFO';

export interface Qualification {
  goal: Goal | null;
  pathway: string | null;
  pathwayLabel: string | null;
  outcome: Outcome;
  completenessPercent: number;
  requirements: Requirement[];
  missing: Requirement[];
  issues: Issue[];
  summary: string;
  assessedAt: string;
  rulesVersion: string;
}
export interface Recommendation {
  type: 'APPLICANT_ACTION' | 'EDUCARO_SERVICE' | 'CONSULTANT_REFERRAL';
  service: string;
  title: string;
  reason: string;
  actions: string[];
  consultantReferral: boolean;
}

export interface Profile {
  id: string;
  goal: Goal | null;
  status: ApplicantStatus;
  personal: Record<string, Tracked>;
  education: EducationItem[];
  employment: EmploymentItem[];
  skills: SkillItem[];
  languages: LanguageItem[];
  motivation: Record<string, Tracked>;
  qualification: Qualification | null;
  recommendation: Recommendation | null;
  cvSummary: string | null;
  submittedAt: string | null;
  accountEmail?: string;
  accountName?: string;
  ownerNotes?: string | null;
  completeness?: { percent: number; missing: string[] };
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface DocItem {
  id: string;
  applicantId: string;
  type: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'UPLOADED' | 'EXTRACTED' | 'CONFIRMED' | 'FAILED';
  extracted: {
    education?: unknown[];
    employment?: unknown[];
    skills?: unknown[];
    languages?: unknown[];
    confidence?: number | null;
    notes?: string[];
  } | null;
  warnings: string[];
  errorMessage: string | null;
  createdAt: string;
}

export interface FaceMatch {
  status: 'MATCHED' | 'NOT_MATCHED' | 'NO_FACE_DETECTED' | 'NO_REFERENCE' | 'NOT_CONFIGURED' | 'ERROR';
  similarity?: number;
  threshold: number;
  framesChecked: number;
  message: string;
}

export interface VideoItem {
  id: string;
  transcript: string | null;
  analysis: {
    background?: string | null;
    motivation?: string | null;
    careerGoals?: string | null;
    preferredPathway?: string | null;
    fieldOfInterest?: string | null;
    preferredCity?: string | null;
    discrepanciesWithProfile?: string[];
  } | null;
  faceMatch: FaceMatch | null;
  notes: string[];
  status: string;
  consentAt: string | null;
  createdAt: string;
}

export interface Guide {
  generatedAt: string;
  unlockedBy: string;
  pathwayTitle: string;
  visa: { name: string; summary: string };
  steps: { title: string; detail: string }[];
  documents: string[];
  costs: { item: string; approx: string }[];
  afterArrival: string[];
  officialLinks: { label: string; url: string }[];
  accommodation: {
    options: { type: string; approx: string; tip: string }[];
    citiesWgRoomApprox: { city: string; approx: string }[];
    platforms: string[];
    scamWarnings: string[];
    note: string;
  };
  personalNotes: string[];
  personalNotesSource: string | null;
  disclaimer: string;
}

export interface OwnerRow {
  id: string;
  email: string;
  name: string;
  goal: Goal | null;
  status: ApplicantStatus;
  outcome: Outcome | null;
  completenessPercent: number | null;
  submittedAt: string | null;
  updatedAt: string;
}

export interface OwnerDetailData {
  applicant: Profile;
  completeness: { percent: number; missing: string[] };
  documents: DocItem[];
  video: VideoItem | null;
  reviewFlags: { identity: string; needsHumanReview: boolean };
}
