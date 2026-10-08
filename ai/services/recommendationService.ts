import { llmService } from "./llmService";
import { recommendationPrompt } from "../prompts/recommendationPrompt";

export interface RecommendationServiceInput {
  applicantProfile: Record<string, unknown>;

  qualificationResult?: Record<string, unknown>;

  missingInformation?: Array<{
    field: string;
    importance: "high" | "medium" | "low";
    reason: string;
    suggestedAction?: string;
  }>;

  consistencyResult?: Record<string, unknown>;
}

export interface RecommendationAssessment {
  recommendedJourney:
    | "study"
    | "vocational_training"
    | "employment"
    | "complete_profile_first"
    | "further_review";

  recommendationTitle: string;

  explanation: string;

  reasons: string[];

  recommendedActions: string[];

  requiredDocuments: string[];

  priority: "high" | "medium" | "low";

  confidence: number;
}

export class RecommendationService {
  async recommend(
    input: RecommendationServiceInput
  ): Promise<RecommendationAssessment> {
    const userPrompt = `
Generate the next-step recommendation for this applicant.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

QUALIFICATION RESULT:

${JSON.stringify(input.qualificationResult ?? {}, null, 2)}

MISSING INFORMATION:

${JSON.stringify(input.missingInformation ?? [], null, 2)}

CONSISTENCY RESULT:

${JSON.stringify(input.consistencyResult ?? {}, null, 2)}

Return the recommendation as JSON.
`;

    return await llmService.generateJSON<RecommendationAssessment>({
      systemPrompt: recommendationPrompt,
      userPrompt,
      temperature: 0.2,
    });
  }
}

export const recommendationService =
  new RecommendationService();