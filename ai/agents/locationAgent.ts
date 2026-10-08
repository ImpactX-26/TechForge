import { llmService } from "../services/llmService";

export interface LocationInput {
  applicantProfile: Record<string, unknown>;

  qualificationResult?: Record<string, unknown>;

  recommendedJourney?: string;
}

export interface LocationRecommendation {
  city: string;
  state?: string;
  country: string;
  reason: string;
  suitability: "high" | "medium" | "low";
}

export interface LocationResult {
  recommendedLocations: LocationRecommendation[];

  locationFactors: string[];

  summary: string;

  confidence: number;
}

export class LocationAgent {
  async recommend(
    input: LocationInput
  ): Promise<LocationResult> {
    const systemPrompt = `
You are the Location Agent for an AI-powered Germany
applicant journey.

Your task is to recommend suitable German cities or regions
based on the applicant's available information and journey.

IMPORTANT RULES:

1. Never invent applicant information.
2. Base recommendations on the information provided.
3. Consider the applicant's selected or recommended journey.
4. Consider relevant factors such as:
   - education
   - field of study
   - employment interests
   - skills
   - language level
   - stated location preferences
   - journey type
5. Do not claim that a specific university, employer,
   training provider, or job is available unless that
   information is explicitly provided.
6. Do not guarantee admission, employment, accommodation,
   or visa approval.
7. If there is not enough applicant information, provide
   a cautious recommendation and explain the limitation.
8. Return ONLY valid JSON.
`;

    const userPrompt = `
Recommend suitable locations in Germany for this applicant.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

QUALIFICATION RESULT:

${JSON.stringify(input.qualificationResult ?? {}, null, 2)}

RECOMMENDED JOURNEY:

${input.recommendedJourney ?? "Not provided"}

Consider which types of German locations could be suitable
for the applicant's journey and background.

Return JSON using exactly this structure:

{
  "recommendedLocations": [
    {
      "city": "",
      "state": "",
      "country": "Germany",
      "reason": "",
      "suitability": "medium"
    }
  ],
  "locationFactors": [],
  "summary": "",
  "confidence": 0
}

Provide a small number of useful recommendations rather than
listing many cities.

The confidence value must be between 0 and 1.
`;

    return await llmService.generateJSON<LocationResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    });
  }
}

export const locationAgent = new LocationAgent();