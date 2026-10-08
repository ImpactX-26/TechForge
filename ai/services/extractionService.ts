import { llmService } from "./llmService";

export interface ExtractedDocumentData {
  documentType: string;

  personal?: {
    name?: string;
    dateOfBirth?: string;
    location?: string;
  };

  education?: {
    institution?: string;
    qualification?: string;
    fieldOfStudy?: string;
    graduationDate?: string;
  };

  employment?: Array<{
    company?: string;
    role?: string;
    responsibilities?: string[];
    startDate?: string;
    endDate?: string;
  }>;

  skills?: string[];

  languages?: Array<{
    language?: string;
    level?: string;
  }>;

  certifications?: string[];

  confidence: number;

  evidence: string[];

  missingInformation: string[];
}

export class ExtractionService {
  async extractDocument(
    documentText: string
  ): Promise<ExtractedDocumentData> {
    const systemPrompt = `
You are a document extraction agent for a Germany applicant journey.

Your task is to extract information from applicant documents.

IMPORTANT RULES:

1. Extract only information that is actually present in the document.
2. Never invent or guess applicant information.
3. If information is missing, leave the field empty.
4. Identify the type of document.
5. Preserve important names, qualifications, institutions and dates.
6. Return a confidence score between 0 and 1.
7. Include evidence describing where the extracted information came from.
8. List important information that appears to be missing.
9. Return ONLY valid JSON.
`;

    const userPrompt = `
Analyze the following applicant document.

DOCUMENT:

${documentText}

Return JSON using this structure:

{
  "documentType": "",
  "personal": {
    "name": "",
    "dateOfBirth": "",
    "location": ""
  },
  "education": {
    "institution": "",
    "qualification": "",
    "fieldOfStudy": "",
    "graduationDate": ""
  },
  "employment": [],
  "skills": [],
  "languages": [],
  "certifications": [],
  "confidence": 0,
  "evidence": [],
  "missingInformation": []
}
`;

    return await llmService.generateJSON<ExtractedDocumentData>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const extractionService = new ExtractionService();