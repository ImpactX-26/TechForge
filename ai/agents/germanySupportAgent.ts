import { llmService } from "../services/llmService";

export interface GermanySupportInput {
  applicantProfile: Record<string, unknown>;

  recommendedJourney?: string;

  qualificationResult?: Record<string, unknown>;

  missingInformation?: Array<{
    field: string;
    importance: "high" | "medium" | "low";
    reason: string;
    suggestedAction?: string;
  }>;

  location?: string;
}

export interface GermanySupportResult {
  journey: string;

  preparationSteps: string[];

  importantConsiderations: string[];

  documentsToPrepare: string[];

  arrivalTasks: string[];

  warnings: string[];

  summary: string;
}

export class GermanySupportAgent {
  async provideSupport(
    input: GermanySupportInput
  ): Promise<GermanySupportResult> {
    const systemPrompt = `
You are the Germany Support Agent for an AI-powered Germany
applicant journey.

Your task is to provide practical preparation and arrival
guidance for an applicant planning to study, complete
vocational training, or work in Germany.

IMPORTANT RULES:

1. Never invent applicant information.
2. Base recommendations on the information provided.
3. Do not provide legal, immigration, visa, or government
   guarantees.
4. Do not claim that an applicant has a visa, admission,
   employment, or legal eligibility.
5. Clearly distinguish preparation suggestions from
   official requirements.
6. When a requirement needs confirmation, tell the applicant
   to verify it with the relevant official authority,
   institution, employer, or provider.
7. Consider the applicant's selected or recommended journey.
8. Include practical preparation steps.
9. Include document preparation guidance.
10. Include useful arrival tasks such as accommodation,
    local registration, transport, healthcare, banking,
    and other relevant settling-in activities when appropriate.
11. Do not invent specific offices, addresses, prices,
    appointment dates, or availability.
12. Return ONLY valid JSON.
`;

    const userPrompt = `
Provide practical Germany preparation and arrival guidance
for this applicant.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

RECOMMENDED JOURNEY:

${input.recommendedJourney ?? "Not provided"}

QUALIFICATION RESULT:

${JSON.stringify(input.qualificationResult ?? {}, null, 2)}

MISSING INFORMATION:

${JSON.stringify(input.missingInformation ?? [], null, 2)}

LOCATION:

${input.location ?? "Not provided"}

Provide guidance relevant to the applicant's journey.

Consider:

- Preparing required documents
- Completing missing profile information
- Preparing for the selected journey
- Accommodation planning
- Local registration
- Health insurance and healthcare preparation
- Banking and financial preparation
- Public transportation
- Important arrival tasks
- Official verification of requirements

Return JSON using exactly this structure:

{
  "journey": "",
  "preparationSteps": [],
  "importantConsiderations": [],
  "documentsToPrepare": [],
  "arrivalTasks": [],
  "warnings": [],
  "summary": ""
}

Do not present assumptions as confirmed requirements.
`;

    return await llmService.generateJSON<GermanySupportResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });
  }
}

export const germanySupportAgent =
  new GermanySupportAgent();