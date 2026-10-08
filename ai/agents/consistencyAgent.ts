import { llmService } from "../services/llmService";

export interface ConsistencyInput {
  applicantProfile: Record<string, unknown>;

  documents?: Array<{
    fileName: string;
    extractedData: Record<string, unknown>;
  }>;

  verificationResult?: Record<string, unknown>;
}

export interface ConsistencyIssue {
  field: string;
  severity: "high" | "medium" | "low";
  source1: string;
  source2: string;
  explanation: string;
  recommendation: string;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  consistentFields: string[];
  summary: string;
}

export class ConsistencyAgent {
  async analyze(
    input: ConsistencyInput
  ): Promise<ConsistencyResult> {
    const systemPrompt = `
You are the Consistency Agent for an AI-powered Germany
applicant journey.

Your task is to identify contradictions or suspicious differences
between information supplied by an applicant and information
available in their documents or verification results.

IMPORTANT RULES:

1. Never invent applicant information.
2. Compare only information that is actually available.
3. Do not treat simple differences in capitalization,
   formatting, abbreviations, or date formats as contradictions.
4. Identify genuine conflicts between sources.
5. Clearly identify which two sources disagree.
6. Classify each issue as high, medium, or low severity.
7. Do not decide that an applicant is fraudulent.
8. Recommend human review when an important inconsistency exists.
9. If there are no inconsistencies, return an empty issues array.
10. Return ONLY valid JSON.
`;

    const userPrompt = `
Analyze the applicant information for consistency.

APPLICANT PROFILE:

${JSON.stringify(input.applicantProfile, null, 2)}

DOCUMENT INFORMATION:

${JSON.stringify(input.documents ?? [], null, 2)}

VERIFICATION RESULT:

${JSON.stringify(input.verificationResult ?? {}, null, 2)}

Check important information such as:

- Name
- Date of birth
- Location
- Education
- Institution
- Degree or qualification
- Field of study
- Graduation date
- Employment history
- Job roles
- Employment dates
- Skills
- Languages
- Certifications

For each genuine inconsistency, explain:

1. What information conflicts.
2. Which sources contain the conflicting information.
3. Why the difference matters.
4. What should be done next.

Return JSON using exactly this structure:

{
  "isConsistent": true,
  "issues": [
    {
      "field": "",
      "severity": "medium",
      "source1": "",
      "source2": "",
      "explanation": "",
      "recommendation": ""
    }
  ],
  "consistentFields": [],
  "summary": ""
}

Set isConsistent to false when one or more meaningful
inconsistencies are found.
`;

    return await llmService.generateJSON<ConsistencyResult>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });
  }
}

export const consistencyAgent =
  new ConsistencyAgent();