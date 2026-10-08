import "dotenv/config";

export interface LLMRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  provider: string;
}

export class LLMService {
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing. Add it to your environment variables."
      );
    }

    const prompt = this.buildPrompt(request);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Gemini API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      text: generatedText,
      provider: "gemini",
    };
  }

  async generateJSON<T>(
    request: LLMRequest
  ): Promise<T> {
    const response = await this.generate({
      ...request,
      systemPrompt:
        `${request.systemPrompt || ""}\n\n` +
        `IMPORTANT: Return ONLY valid JSON. ` +
        `Do not include markdown code fences or explanations.`,
    });

    try {
      return JSON.parse(response.text) as T;
    } catch {
      const cleaned = this.cleanJSON(response.text);

      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new Error(
          `Failed to parse Gemini response as JSON:\n${response.text}`
        );
      }
    }
  }

  private buildPrompt(request: LLMRequest): string {
    let prompt = "";

    if (request.systemPrompt) {
      prompt += `SYSTEM INSTRUCTIONS:\n${request.systemPrompt}\n\n`;
    }

    prompt += `USER REQUEST:\n${request.userPrompt}`;

    return prompt;
  }

  private cleanJSON(text: string): string {
    return text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
  }
}

export const llmService = new LLMService();