import { llmService } from "../services/llmService";

export interface AccommodationInput {
  city: string;

  applicantProfile?: Record<string, unknown>;

  recommendedJourney?: string;

  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };

  preferences?: string[];
}

export interface AccommodationRecommendation {
  type:
    | "student_residence"
    | "shared_apartment"
    | "private_apartment"
    | "hostel"
    | "temporary_accommodation";

  suitability: "high" | "medium" | "low";

  reason: string;

  considerations: string[];
}

export interface AccommodationResult {
  city: string;

  recommendations: AccommodationRecommendation[];

  searchFactors: string[];

  summary: string;
}

export class AccommodationAgent {
  async recommend(
    input: AccommodationInput
  ): Promise<AccommodationResult> {
    const systemPrompt = `
You are the Accommodation Agent for an AI-powered Germany
applicant journey.

Your task is to recommend suitable accommodation types
for an applicant planning to stay in Germany.

IMPORTANT RULES:

1. Never invent accommodation listings, prices,
   addresses, availability, or landlords.
2. Recommend accommodation TYPES, not unverified
   specific properties.
3. Consider the applicant's city, journey, budget,
   preferences, and profile when available.
4. Consider options such as:
   - student residences
   - shared apartments
   - private apartments
   - hostels
   - temporary accommodation
5. If the applicant is arriving for study, consider
   student accommodation where appropriate.
6. If the applicant needs temporary housing before
   finding permanent accommodation, identify that option.
7. Do not guarantee availability or affordability.
8. Clearly mention important considerations such as:
   - rent
   - deposit
   - contract duration
   - registration requirements
   - location
   - transport access
9. Return ONLY valid JSON.
`;

    const userPrompt = `
Recommend suitable accommodation options for this applicant.

CITY:

${input.city}

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile ?? {}, null, 2)}

RECOMMENDED JOURNEY:

${input.recommendedJourney ?? "Not provided"}

BUDGET:

${JSON.stringify(input.budget ?? {}, null, 2)}

PREFERENCES:

${JSON.stringify(input.preferences ?? [], null, 2)}

Return JSON using exactly this structure:

{
  "city": "",
  "recommendations": [
    {
      "type": "student_residence",
      "suitability": "high",
      "reason": "",
      "considerations": []
    }
  ],
  "searchFactors": [],
  "summary": ""
}

Recommend only accommodation types that are reasonably
relevant to the information provided.
Do not create specific accommodation listings.
`;

    return await llmService.generateJSON<AccommodationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });
  }
}

export const accommodationAgent =
  new AccommodationAgent();