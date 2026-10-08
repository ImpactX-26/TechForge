import { llmService } from "../services/llmService";

export interface MissingInformationInput {
  applicantProfile: Record<string, unknown>;

  verificationResult?: {
    overallStatus?: string;
    issues?: Array<{
      field?: string;
      status?: string;
      explanation?: string;
    }>;
  };
}

export interface MissingInformationResult {
  missingInformation: Array<{
    field: string;
    importance: "high" | "medium" | "low";
    reason: string;
    suggestedAction: string;
  }>;

  questionsToAsk: string[];

  completenessScore: number;

  summary: string;
}

export class MissingInformationAgent {
  async analyze(
    input: MissingInformationInput
  ): Promise<MissingInformationResult> {
    const systemPrompt = `
You are the Missing Information Agent for an AI-powered Germany
applicant journey.

Your task is to identify information that is missing or incomplete
from an applicant profile.

IMPORTANT RULES:

1. Never invent applicant information.
2. Do not assume that missing information exists.
3. Only identify information that is actually missing or incomplete.
4. Use verification issues when they indicate missing information.
5. Prioritize information that is important for the applicant's
   selected goal.
6. Classify importance as high, medium, or low.
7. Suggest a practical action for obtaining each missing item.
8. Generate clear questions that can be shown to the applicant.
9. Calculate a completeness score from 0 to 100.
10. Return ONLY valid JSON.
`;

    const userPrompt = `
Analyze the following applicant profile and identify missing or
incomplete information.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

VERIFICATION RESULT:

${JSON.stringify(input.verificationResult ?? {}, null, 2)}

Consider information such as:

- Personal information
- Contact information
- Selected goal
- Education
- Degree
- Field of study
- Graduation year
- Employment experience
- Skills
- German language level
- English language level
- Motivation
- Supporting documents
- Information identified as inconsistent or missing during verification

Do not mark information as missing if it is clearly available
in the applicant profile or verified documents.

Return JSON using exactly this structure:

{
  "missingInformation": [
    {
      "field": "",
      "importance": "high",
      "reason": "",
      "suggestedAction": ""
    }
  ],
  "questionsToAsk": [],
  "completenessScore": 0,
  "summary": ""
}

The completenessScore must be between 0 and 100.

If no important information is missing, return an empty
missingInformation array and an appropriate summary.
`;

    return await llmService.generateJSON<MissingInformationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const missingInformationAgent =
  new MissingInformationAgent();