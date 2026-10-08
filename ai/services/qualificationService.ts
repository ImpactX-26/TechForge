import { llmService } from "./llmService";
import { qualificationPrompt } from "../prompts/qualificationPrompt";

export interface QualificationServiceInput {
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

export interface QualificationAssessment {
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

export class QualificationService {
  async assess(
    input: QualificationServiceInput
  ): Promise<QualificationAssessment> {
    const userPrompt = `
Assess this applicant using the qualification instructions.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

DOCUMENTS:

${JSON.stringify(input.documents ?? [], null, 2)}

MISSING INFORMATION:

${JSON.stringify(input.missingInformation ?? [], null, 2)}

CONSISTENCY RESULT:

${JSON.stringify(input.consistencyResult ?? {}, null, 2)}

Return the qualification assessment as JSON.
`;

    return await llmService.generateJSON<QualificationAssessment>({
      systemPrompt: qualificationPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const qualificationService =
  new QualificationService();