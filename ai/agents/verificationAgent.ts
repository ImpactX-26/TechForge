import { llmService } from "../services/llmService";

export interface VerificationInput {
  applicantProfile: Record<string, unknown>;

  documents?: Array<{
    fileName: string;
    extractedData: Record<string, unknown>;
  }>;
}

export interface VerificationIssue {
  field: string;
  status: "verified" | "inconsistent" | "missing";
  applicantValue?: unknown;
  documentValue?: unknown;
  explanation: string;
}

export interface VerificationResult {
  overallStatus: "verified" | "needs_review";
  verifiedFields: string[];
  issues: VerificationIssue[];
  summary: string;
}

export class VerificationAgent {
  async verify(
    input: VerificationInput
  ): Promise<VerificationResult> {
    const systemPrompt = `
You are a Verification Agent for a Germany applicant journey.

Your task is to compare applicant-provided information with
information extracted from supporting documents.

IMPORTANT RULES:

1. Never invent information.
2. Do not change the applicant's information.
3. If the applicant and document contain matching information,
   mark it as "verified".
4. If they clearly contradict each other, mark it as "inconsistent".
5. If required information is unavailable, mark it as "missing".
6. Minor formatting differences such as capitalization should not
   automatically be considered inconsistent.
7. Clearly explain every inconsistency.
8. Return ONLY valid JSON.
`;

    const userPrompt = `
Verify the following applicant profile against the extracted
document information.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

DOCUMENT INFORMATION:

${JSON.stringify(input.documents ?? [], null, 2)}

Check important fields such as:

- Name
- Date of birth
- Education
- Degree
- Field of study
- Graduation date
- Employment
- Skills
- Languages
- Certifications

Return JSON using exactly this structure:

{
  "overallStatus": "verified",
  "verifiedFields": [],
  "issues": [
    {
      "field": "",
      "status": "verified",
      "applicantValue": "",
      "documentValue": "",
      "explanation": ""
    }
  ],
  "summary": ""
}

Use "needs_review" as overallStatus if there are important
inconsistencies or missing information.
`;

    return await llmService.generateJSON<VerificationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const verificationAgent = new VerificationAgent();