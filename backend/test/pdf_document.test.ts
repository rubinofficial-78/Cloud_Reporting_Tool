import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createReportPdf } from "../src/reports/pdf_document.js";

test("report PDF generation produces a readable PDF document", async () => {
  const bytes = await createReportPdf({
    version: {
      versionNumber: 1,
      content: { findings: "Synthetic findings", impression: "No acute finding" },
      amendmentReason: null,
      signedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    template: {
      sections: [
        { key: "findings", label: "Findings", required: true },
        { key: "impression", label: "Impression", required: true },
      ],
    },
    order: {
      accessionNumber: "ORD-TEST-1",
      modality: "CT",
      procedureName: "CT Head",
    },
    patient: {
      medicalRecordNumber: "TEST-1",
      firstName: "Synthetic",
      lastName: "Patient",
      dateOfBirth: "1980-01-01",
    },
    facility: {
      name: "5C Networks",
      address: "1/100, Silk Board Main, Bangalore, 642201",
      phone: "9344864492",
    },
    signer: { email: "radiologist@example.test" },
  });
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
});
