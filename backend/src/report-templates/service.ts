import { HttpError } from "../../shared/middleware/http_error.js";
import type { ReportTemplateSection } from "../../shared/db/schema.js";
import * as templateRepository from "../../shared/repository/report-template.repository.js";

export async function listTemplates(facilityId: string) {
  return templateRepository.listTemplates(facilityId);
}

export async function createTemplate(
  facilityId: string,
  createdBy: string,
  name: string,
  sections: ReportTemplateSection[],
) {
  try {
    return await templateRepository.createTemplate(
      facilityId,
      createdBy,
      name,
      sections,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HttpError(409, "A template with this name already exists");
    }
    throw error;
  }
}
