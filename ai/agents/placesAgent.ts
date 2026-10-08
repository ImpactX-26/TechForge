import { llmService } from "../services/llmService";

export interface PlacesInput {
  city: string;
  country?: string;

  applicantProfile?: Record<string, unknown>;

  recommendedJourney?: string;
}

export interface PlaceRecommendation {
  category:
    | "hospital"
    | "pharmacy"
    | "bank"
    | "supermarket"
    | "accommodation"
    | "police"
    | "transport"
    | "government"
    | "other";

  name: string;

  reason: string;
}

export interface PlacesResult {
  city: string;

  places: PlaceRecommendation[];

  emergencyInformation: {
    police: string;
    ambulance: string;
    emergencyNumber: string;
  };

  summary: string;
}

export class PlacesAgent {
  async recommend(
    input: PlacesInput
  ): Promise<PlacesResult> {
    const systemPrompt = `
You are the Places Agent for an AI-powered Germany
applicant journey.

Your task is to identify the types of essential places
an applicant may need after arriving in Germany.

IMPORTANT RULES:

1. Never invent specific business names, addresses,
   phone numbers, opening hours, or locations.
2. This agent provides useful place categories and
   general recommendations.
3. Actual nearby places should be obtained from a
   real location or maps service.
4. Consider the applicant's city and journey.
5. Include essential categories such as:
   - hospitals
   - pharmacies
   - banks
   - supermarkets
   - accommodation
   - police
   - public transport
   - government offices
6. Emergency information must use the standard German
   emergency numbers.
7. Do not claim that a specific place exists nearby
   unless verified by a location service.
8. Return ONLY valid JSON.
`;

    const userPrompt = `
Prepare essential place recommendations for an applicant
who is planning to stay in:

CITY:

${input.city}

COUNTRY:

${input.country ?? "Germany"}

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile ?? {}, null, 2)}

RECOMMENDED JOURNEY:

${input.recommendedJourney ?? "Not provided"}

Identify useful categories of places that the applicant
may need after arriving.

Return JSON using exactly this structure:

{
  "city": "",
  "places": [
    {
      "category": "hospital",
      "name": "Nearby hospital",
      "reason": ""
    }
  ],
  "emergencyInformation": {
    "police": "110",
    "ambulance": "112",
    "emergencyNumber": "112"
  },
  "summary": ""
}

Do not invent actual nearby business names.
Use category-level recommendations when actual place
data has not been supplied.
`;

    return await llmService.generateJSON<PlacesResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const placesAgent = new PlacesAgent();