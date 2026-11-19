import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

interface PdfSource {
  version: {
    versionNumber: number;
    content: Record<string, string>;
    amendmentReason: string | null;
    signedAt: Date;
  };
  template: {
    sections: Array<{ key: string; label: string; required: boolean }>;
  };
  order: {
    accessionNumber: string;
    modality: string;
    procedureName: string;
  };
  patient: {
    medicalRecordNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
  };
  facility: { name: string; address: string | null; phone: string | null };
  signer: { email: string };
}

function wrapText(value: string, maximumLength = 92): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      if (line && `${line} ${word}`.length > maximumLength) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function createReportPdf(source: PdfSource): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(
    await readFile(
      fileURLToPath(
        new URL("../../assets/5c-networks-logo.png", import.meta.url),
      ),
    ),
  );
  let page = pdf.addPage();
  const drawHeader = (target: typeof page) => {
    const { width, height } = target.getSize();
    const logoSize = logo.scaleToFit(58, 58);
    target.drawImage(logo, {
      x: 48,
      y: height - 108,
      width: logoSize.width,
      height: logoSize.height,
    });
    target.drawText(source.facility.name, {
      x: 122,
      y: height - 57,
      size: 16,
      font: bold,
      color: rgb(0.12, 0.16, 0.23),
    });
    if (source.facility.address) {
      target.drawText(source.facility.address, {
        x: 122,
        y: height - 76,
        size: 9,
        font,
        color: rgb(0.12, 0.16, 0.23),
      });
    }
    if (source.facility.phone) {
      target.drawText(`Phone: ${source.facility.phone}`, {
        x: 122,
        y: height - 92,
        size: 9,
        font,
        color: rgb(0.12, 0.16, 0.23),
      });
    }
    target.drawText("Radiology Report", {
      x: 48,
      y: height - 130,
      size: 12,
      font: bold,
      color: rgb(0.12, 0.16, 0.23),
    });
    target.drawLine({
      start: { x: 48, y: height - 140 },
      end: { x: width - 48, y: height - 140 },
      thickness: 0.7,
      color: rgb(0.72, 0.76, 0.81),
    });
    return height - 160;
  };
  let y = drawHeader(page);

  const drawLine = (text: string, isHeading = false) => {
    const selectedFont = isHeading ? bold : font;
    for (const line of wrapText(text)) {
      if (y < 48) {
        page = pdf.addPage();
        y = drawHeader(page);
      }
      page.drawText(line, {
        x: 48,
        y,
        size: isHeading ? 12 : 10,
        font: selectedFont,
        color: rgb(0.12, 0.16, 0.23),
      });
      y -= isHeading ? 20 : 15;
    }
  };

  drawLine(`Patient: ${source.patient.firstName} ${source.patient.lastName}`);
  drawLine(`Medical record number: ${source.patient.medicalRecordNumber}`);
  if (source.patient.dateOfBirth) {
    drawLine(`Date of birth: ${source.patient.dateOfBirth}`);
  }
  drawLine(`Accession: ${source.order.accessionNumber}`);
  drawLine(`Procedure: ${source.order.modality} - ${source.order.procedureName}`);
  drawLine(`Signed: ${source.version.signedAt.toISOString()}`);
  drawLine(`Signed by: ${source.signer.email}`);
  drawLine(`Version: ${source.version.versionNumber}`);

  for (const section of source.template.sections) {
    drawLine(section.label, true);
    drawLine(source.version.content[section.key] ?? "");
  }
  if (source.version.amendmentReason) {
    drawLine("Amendment reason", true);
    drawLine(source.version.amendmentReason);
  }

  return pdf.save();
}
