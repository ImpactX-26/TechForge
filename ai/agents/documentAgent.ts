import {
  extractionService,
  ExtractedDocumentData,
} from "../services/extractionService";

export interface DocumentInput {
  fileName: string;
  documentText: string;
}

export interface DocumentAgentResult {
  success: boolean;
  fileName: string;
  extractedData?: ExtractedDocumentData;
  error?: string;
}

export class DocumentAgent {
  async processDocument(
    input: DocumentInput
  ): Promise<DocumentAgentResult> {
    try {
      if (!input.fileName) {
        return {
          success: false,
          fileName: "",
          error: "Document filename is missing.",
        };
      }

      if (!input.documentText?.trim()) {
        return {
          success: false,
          fileName: input.fileName,
          error: "No readable text was found in the document.",
        };
      }

      const extractedData =
        await extractionService.extractDocument(
          input.documentText
        );

      return {
        success: true,
        fileName: input.fileName,
        extractedData,
      };
    } catch (error) {
      return {
        success: false,
        fileName: input.fileName,
        error:
          error instanceof Error
            ? error.message
            : "Document processing failed.",
      };
    }
  }
}

export const documentAgent = new DocumentAgent();