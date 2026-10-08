import { llmService } from "../services/llmService";

export interface RecommendationInput {
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

export interface RecommendationResult {
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

export class RecommendationAgent {
  async recommend(
    input: RecommendationInput
  ): Promise<RecommendationResult> {
    const systemPrompt = `
You are the Recommendation Agent for an AI-powered Germany
applicant journey.

Your task is to recommend the most appropriate next journey
or action for an applicant.

IMPORTANT RULES:

1. Never invent applicant information.
2. Base recommendations only on the information provided.
3. Respect the applicant's selected goal.
4. Do not change the applicant's goal without explaining why.
5. Consider qualification results, missing information,
   and consistency issues.
6. If important information is missing, recommend completing
   the profile before making a final journey recommendation.
7. Possible journeys are:
   - study
   - vocational_training
   - employment
8. Use "complete_profile_first" when important information
   is missing.
9. Use "further_review" when significant inconsistencies
   require additional verification.
10. Do not make legal, visa, immigration, or admission guarantees.
11. Clearly explain why the recommendation was made.
12. Recommend practical next actions.
13. Only recommend documents that are relevant to the
    applicant's situation or missing information.
14. Return ONLY valid JSON.
`;

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

Determine the most appropriate next step.

Consider:

- Applicant's selected goal
- Education and qualifications
- Employment experience
- Skills
- Language levels
- Available documents
- Missing information
- Qualification assessment
- Consistency issues

Return JSON using exactly this structure:

{
  "recommendedJourney": "complete_profile_first",
  "recommendationTitle": "",
  "explanation": "",
  "reasons": [],
  "recommendedActions": [],
  "requiredDocuments": [],
  "priority": "high",
  "confidence": 0
}

The confidence value must be between 0 and 1.
`;

    return await llmService.generateJSON<RecommendationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });
  }
}

export const recommendationAgent =
  new RecommendationAgent();