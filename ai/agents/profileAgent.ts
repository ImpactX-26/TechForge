import { llmService } from "../services/llmService";
import { ExtractedDocumentData } from "../services/extractionService";

export interface ApplicantInput {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;

  goal?: "study" | "vocational_training" | "employment";

  degree?: string;
  field?: string;
  graduationYear?: number;

  skills?: string[];

  germanLevel?: string;
  englishLevel?: string;

  motivation?: string;
}

export interface ApplicantProfile {
  personal: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
  };

  goal?: string;

  education: {
    degree?: string;
    field?: string;
    graduationYear?: number;
    institutions?: string[];
  };

  employment: Array<{
    company?: string;
    role?: string;
    responsibilities?: string[];
    duration?: string;
  }>;

  skills: string[];

  languages: Array<{
    language: string;
    level: string;
  }>;

  motivation?: string;

  documents: Array<{
    documentType: string;
    fileName: string;
    confidence: number;
  }>;

  missingInformation: string[];

  profileCompleteness: number;
}

export class ProfileAgent {
  async buildProfile(
    applicant: ApplicantInput,
    documents: Array<{
      fileName: string;
      data: ExtractedDocumentData;
    }> = []
  ): Promise<ApplicantProfile> {
    const systemPrompt = `
You are the Profile Agent for an AI-powered Germany applicant journey.

Your job is to combine applicant-provided information and information
extracted from documents into one structured applicant profile.

IMPORTANT RULES:

1. Never invent applicant information.
2. Applicant-provided information should be preserved.
3. Document-extracted information should only be included when it is
   actually present in the extracted document data.
4. Do not assume missing education, employment, skills or language levels.
5. Identify missing information instead of guessing it.
6. Calculate profile completeness as a percentage from 0 to 100.
7. Keep the applicant's selected goal exactly as provided.
8. Return ONLY valid JSON.
`;

    const userPrompt = `
Build a structured applicant profile from the following information.

APPLICANT-PROVIDED INFORMATION:

${JSON.stringify(applicant, null, 2)}

DOCUMENT-EXTRACTED INFORMATION:

${JSON.stringify(documents, null, 2)}

Return JSON using exactly this structure:

{
  "personal": {
    "name": "",
    "email": "",
    "phone": "",
    "location": ""
  },
  "goal": "",
  "education": {
    "degree": "",
    "field": "",
    "graduationYear": 0,
    "institutions": []
  },
  "employment": [],
  "skills": [],
  "languages": [],
  "motivation": "",
  "documents": [],
  "missingInformation": [],
  "profileCompleteness": 0
}

Use empty values or empty arrays when information is unavailable.
Do not create information that was not provided.
`;

    return await llmService.generateJSON<ApplicantProfile>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const profileAgent = new ProfileAgent();