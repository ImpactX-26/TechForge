import { llmService } from "../services/llmService";

export interface QualificationInput {
  applicantProfile: Record<string, unknown>;

  documents?: Array<{
    fileName: string;
    extractedData: Record<string, unknown>;
  }>;

  missingInformation?: Array<{
    field: string;
    importance: "high" | "medium" | "low";
    reason: string;
  }>;

  consistencyResult?: Record<string, unknown>;
}

export interface QualificationResult {
  qualificationStatus:
    | "qualified"
    | "partially_qualified"
    | "not_yet_qualified"
    | "insufficient_information";

  goal: string;

  strengths: string[];

  requirementsMet: string[];

  requirementsMissing: string[];

  concerns: string[];

  reasoning: string;

  nextSteps: string[];

  confidence: number;
}

export class QualificationAgent {
  async assess(
    input: QualificationInput
  ): Promise<QualificationResult> {
    const systemPrompt = `
You are the Qualification Agent for an AI-powered Germany
applicant journey.

Your task is to assess an applicant based only on the information
available in their profile, documents, missing-information analysis,
and consistency analysis.

IMPORTANT RULES:

1. Never invent applicant information.
2. Never claim that an applicant satisfies a requirement when
   the required information is unavailable.
3. Clearly distinguish between:
   - requirements that are supported by available information
   - requirements that are missing
   - concerns that require further verification
4. Consider the applicant's selected goal.
5. The possible goals are:
   - study
   - vocational_training
   - employment
6. If there is insufficient information to make a reliable
   assessment, use "insufficient_information".
7. If some requirements are satisfied but important requirements
   are still missing, use "partially_qualified".
8. If the applicant cannot currently demonstrate the required
   qualifications, use "not_yet_qualified".
9. Use "qualified" only when the available information provides
   sufficient support for the assessment.
10. Do not make legal or immigration guarantees.
11. Identify what the applicant should do next.
12. Return ONLY valid JSON.
`;

    const userPrompt = `
Assess the applicant's qualification for their selected Germany
journey.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

DOCUMENT INFORMATION:

${JSON.stringify(input.documents ?? [], null, 2)}

MISSING INFORMATION:

${JSON.stringify(input.missingInformation ?? [], null, 2)}

CONSISTENCY RESULT:

${JSON.stringify(input.consistencyResult ?? {}, null, 2)}

Assess the applicant based on available evidence.

Consider:

- Selected goal
- Education
- Degree or qualification
- Field of study
- Graduation information
- Employment experience
- Skills
- German language level
- English language level
- Certifications
- Supporting documents
- Missing information
- Consistency issues

Do not assume requirements that are not supported by the
available information.

Return JSON using exactly this structure:

{
  "qualificationStatus": "insufficient_information",
  "goal": "",
  "strengths": [],
  "requirementsMet": [],
  "requirementsMissing": [],
  "concerns": [],
  "reasoning": "",
  "nextSteps": [],
  "confidence": 0
}

The confidence value must be between 0 and 1.
`;

    return await llmService.generateJSON<QualificationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const qualificationAgent =
  new QualificationAgent();