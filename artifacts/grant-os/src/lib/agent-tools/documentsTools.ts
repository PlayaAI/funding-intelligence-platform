import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { stripDocumentContent } from "./builders";
import { makeToolError } from "./safety";

export function createDocumentTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_documents",
      description: "List documents with optional relation filters.",
      permissionLevel: "read",
      inputSchema: z.object({
        relatedGrantId: z.string().optional(),
        relatedApplicationId: z.string().optional(),
        relatedProjectId: z.string().optional(),
        relatedFunderId: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
        includeExtractedText: z.boolean().optional(),
      }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Document metadata and extracted text may be sensitive."],
      relatedTables: ["documents"],
      touchesRealDb: true,
      async execute(input) {
        const DEFAULT_LIMIT = 25;
        const cap = Math.min(input.limit ?? DEFAULT_LIMIT, 100);
        const documents = await repository.listDocuments(input);
        const paged = documents.slice(0, cap);
        const items = input.includeExtractedText ? paged : paged.map(stripDocumentContent);
        return { items, total: documents.length, limit: cap, includeExtractedText: input.includeExtractedText ?? false };
      },
    },
    {
      name: "get_document",
      description: "Get one document by id. extracted_text is omitted by default; pass includeExtractedText: true to include it.",
      permissionLevel: "read",
      inputSchema: z.object({ documentId: z.string().min(1), includeExtractedText: z.boolean().optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Full document metadata may include internal storage paths. Extracted text can be very large."],
      relatedTables: ["documents"],
      touchesRealDb: true,
      async execute({ documentId, includeExtractedText }) {
        const document = await repository.getDocument(documentId);
        if (!document) throw makeToolError("document_not_found", `Document ${documentId} was not found.`);
        return { document: includeExtractedText ? document : stripDocumentContent(document) };
      },
    },
    {
      name: "get_documents_for_grant",
      description: "Fetch documents for a grant and related funder context.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1), includeExtractedText: z.boolean().optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Document lists may expose funder-linked private materials."],
      relatedTables: ["grants", "funders", "documents"],
      touchesRealDb: true,
      async execute({ grantId, includeExtractedText }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const funder = grant.funder_id ? await repository.getFunder(grant.funder_id) : null;
        const documents = await repository.listGrantDocuments(grant, funder);
        return { documents: includeExtractedText ? documents : documents.map(stripDocumentContent) };
      },
    },
    {
      name: "get_documents_for_application",
      description: "Fetch documents linked to an application.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1), includeExtractedText: z.boolean().optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Application documents may expose draft submissions."],
      relatedTables: ["applications", "documents"],
      touchesRealDb: true,
      async execute({ applicationId, includeExtractedText }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        const documents = await repository.listDocuments({ relatedApplicationId: applicationId });
        return { application, documents: includeExtractedText ? documents : documents.map(stripDocumentContent) };
      },
    },
  ];
}
