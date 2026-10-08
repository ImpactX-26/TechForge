import { llmService } from "./services/llmService";

async function test() {
  try {
    const result = await llmService.generateJSON<{
      message: string;
      status: string;
    }>({
      userPrompt: `
Return a JSON object with exactly these two fields:

{
  "message": "Gemini JSON connection successful",
  "status": "success"
}
      `,
      temperature: 0,
    });

    console.log("GEMINI JSON TEST SUCCESSFUL");
    console.log(result);
  } catch (error) {
    console.error("GEMINI JSON TEST FAILED:");
    console.error(error);
  }
}

test();