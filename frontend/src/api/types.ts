export type StaffRole = "front_desk" | "radiologist" | "facility_admin";
export type OrderStatus =
  | "unassigned"
  | "assigned"
  | "in_progress"
  | "reported"
  | "cancelled";
export type ScanModality = "XR" | "CT" | "MRI" | "PET" | "US" | "OTHER";
export type OrderPriority = "routine" | "urgent" | "stat";
export type PdfStatus = "pending" | "processing" | "ready" | "failed";

export interface StaffUser {
  id: string;
  email: string;
  facilityId: string;
  facilityName: string;
  role: StaffRole;
}

export interface Patient {
  id: string;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  createdAt: string;
}

export interface WorklistOrder {
  order: {
    id: string;
    accessionNumber: string;
    modality: ScanModality;
    procedureName: string;
    priority: OrderPriority;
    status: OrderStatus;
    assignedRadiologistId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  patient: Pick<
    Patient,
    "id" | "medicalRecordNumber" | "firstName" | "lastName" | "dateOfBirth"
  >;
}

export interface OrderDetail extends WorklistOrder {
  order: WorklistOrder["order"] & { createdBy: string };
}

export interface ReportSection {
  key: string;
  label: string;
  required: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  version: number;
  sections: ReportSection[];
}

export interface ReportVersion {
  id: string;
  versionNumber: number;
  content: Record<string, string>;
  amendmentReason: string | null;
  pdfStatus: PdfStatus;
  signedAt: string;
  signedBy: string;
}

export interface ReportDraft {
  id: string;
  orderId: string;
  templateId: string;
  status: "draft" | "signed";
  draftContent: Record<string, string>;
  draftAmendmentReason: string | null;
  latestVersionNumber: number;
  versions: ReportVersion[];
}

export interface ReportOverview {
  report: {
    id: string;
    status: "draft" | "signed";
    latestVersionNumber: number;
  };
  order: { assignedRadiologistId: string | null };
  latestVersion: {
    id: string;
    versionNumber: number;
    pdfStatus: PdfStatus;
    signedAt: string;
  } | null;
}

export interface Radiologist {
  id: string;
  email: string;
  role: "radiologist";
  active: boolean;
}

export interface ShareLink {
  id: string;
  url: string;
  expiresAt: string;
}
