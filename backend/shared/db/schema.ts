import { sql } from "drizzle-orm";
import {
  date,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", [
  "front_desk",
  "radiologist",
  "facility_admin",
]);

export const scanModality = pgEnum("scan_modality", [
  "XR",
  "CT",
  "MRI",
  "PET",
  "US",
  "OTHER",
]);

export const orderPriority = pgEnum("order_priority", [
  "routine",
  "urgent",
  "stat",
]);

export const orderStatus = pgEnum("order_status", [
  "unassigned",
  "assigned",
  "in_progress",
  "reported",
  "cancelled",
]);

export const reportStatus = pgEnum("report_status", ["draft", "signed"]);

export const pdfStatus = pgEnum("pdf_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const jobStatus = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export interface ReportTemplateSection {
  key: string;
  label: string;
  required: boolean;
}

export const facilities = pgTable("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  address: varchar("address", { length: 300 }),
  phone: varchar("phone", { length: 40 }),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
    .defaultNow()
    .notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const facilityMemberships = pgTable(
  "facility_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: membershipRole("role").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("facility_memberships_facility_user_unique").on(
      table.facilityId,
      table.userId,
    ),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    medicalRecordNumber: varchar("medical_record_number", {
      length: 64,
    }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  },
  (table) => [
    uniqueIndex("patients_facility_mrn_unique").on(
      table.facilityId,
      table.medicalRecordNumber,
    ),
    uniqueIndex("patients_facility_id_unique").on(
      table.facilityId,
      table.id,
    ),
    index("patients_facility_created_id_idx").on(
      table.facilityId,
      table.createdAt,
      table.id,
    ),
    index("patients_mrn_trgm_idx").using(
      "gin",
      sql`${table.medicalRecordNumber} gin_trgm_ops`,
    ),
    index("patients_first_name_trgm_idx").using(
      "gin",
      sql`${table.firstName} gin_trgm_ops`,
    ),
    index("patients_last_name_trgm_idx").using(
      "gin",
      sql`${table.lastName} gin_trgm_ops`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    patientId: uuid("patient_id").notNull(),
    accessionNumber: varchar("accession_number", { length: 64 }).notNull(),
    modality: scanModality("modality").notNull(),
    procedureName: varchar("procedure_name", { length: 200 }).notNull(),
    priority: orderPriority("priority").default("routine").notNull(),
    status: orderStatus("status").default("unassigned").notNull(),
    createdBy: uuid("created_by").notNull(),
    assignedRadiologistId: uuid("assigned_radiologist_id"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("orders_facility_accession_unique").on(
      table.facilityId,
      table.accessionNumber,
    ),
    uniqueIndex("orders_facility_id_unique").on(table.facilityId, table.id),
    index("orders_facility_status_created_idx").on(
      table.facilityId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("orders_facility_assignee_status_created_idx").on(
      table.facilityId,
      table.assignedRadiologistId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("orders_accession_trgm_idx").using(
      "gin",
      sql`${table.accessionNumber} gin_trgm_ops`,
    ),
    foreignKey({
      columns: [table.facilityId, table.patientId],
      foreignColumns: [patients.facilityId, patients.id],
      name: "orders_facility_patient_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.createdBy],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "orders_facility_creator_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.assignedRadiologistId],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "orders_facility_assignee_fk",
    }),
  ],
);

export const reportTemplates = pgTable(
  "report_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    name: varchar("name", { length: 120 }).notNull(),
    version: integer("version").default(1).notNull(),
    sections: jsonb("sections").$type<ReportTemplateSection[]>().notNull(),
    active: boolean("active").default(true).notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("report_templates_facility_name_version_unique").on(
      table.facilityId,
      table.name,
      table.version,
    ),
    uniqueIndex("report_templates_facility_id_unique").on(
      table.facilityId,
      table.id,
    ),
    foreignKey({
      columns: [table.facilityId, table.createdBy],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "report_templates_facility_creator_fk",
    }),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    orderId: uuid("order_id").notNull(),
    templateId: uuid("template_id").notNull(),
    draftContent: jsonb("draft_content")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    draftAmendmentReason: text("draft_amendment_reason"),
    status: reportStatus("status").default("draft").notNull(),
    latestVersionNumber: integer("latest_version_number").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reports_facility_order_unique").on(
      table.facilityId,
      table.orderId,
    ),
    uniqueIndex("reports_facility_id_unique").on(table.facilityId, table.id),
    foreignKey({
      columns: [table.facilityId, table.orderId],
      foreignColumns: [orders.facilityId, orders.id],
      name: "reports_facility_order_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.templateId],
      foreignColumns: [reportTemplates.facilityId, reportTemplates.id],
      name: "reports_facility_template_fk",
    }),
  ],
);

export const reportVersions = pgTable(
  "report_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    reportId: uuid("report_id").notNull(),
    templateId: uuid("template_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    content: jsonb("content").$type<Record<string, string>>().notNull(),
    amendmentReason: text("amendment_reason"),
    signedBy: uuid("signed_by").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    pdfStatus: pdfStatus("pdf_status").default("pending").notNull(),
    pdfRelativePath: text("pdf_relative_path"),
    pdfSha256: varchar("pdf_sha256", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("report_versions_facility_report_number_unique").on(
      table.facilityId,
      table.reportId,
      table.versionNumber,
    ),
    uniqueIndex("report_versions_facility_id_unique").on(
      table.facilityId,
      table.id,
    ),
    foreignKey({
      columns: [table.facilityId, table.reportId],
      foreignColumns: [reports.facilityId, reports.id],
      name: "report_versions_facility_report_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.templateId],
      foreignColumns: [reportTemplates.facilityId, reportTemplates.id],
      name: "report_versions_facility_template_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.signedBy],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "report_versions_facility_signer_fk",
    }),
  ],
);

export const patientShareLinks = pgTable(
  "patient_share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    reportVersionId: uuid("report_version_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    createdBy: uuid("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    lastAccessAt: timestamp("last_access_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("patient_share_links_token_hash_unique").on(table.tokenHash),
    uniqueIndex("patient_share_links_facility_id_unique").on(
      table.facilityId,
      table.id,
    ),
    foreignKey({
      columns: [table.facilityId, table.reportVersionId],
      foreignColumns: [reportVersions.facilityId, reportVersions.id],
      name: "patient_share_links_facility_version_fk",
    }),
    foreignKey({
      columns: [table.facilityId, table.createdBy],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "patient_share_links_facility_creator_fk",
    }),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    actorUserId: uuid("actor_user_id"),
    action: varchar("action", { length: 80 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_facility_created_idx").on(
      table.facilityId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.facilityId, table.actorUserId],
      foreignColumns: [facilityMemberships.facilityId, facilityMemberships.userId],
      name: "audit_events_facility_actor_fk",
    }),
  ],
);

export const outboxJobs = pgTable(
  "outbox_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id),
    jobType: varchar("job_type", { length: 80 }).notNull(),
    status: jobStatus("status").default("pending").notNull(),
    payload: jsonb("payload").$type<Record<string, string>>().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, precision: 3 }),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("outbox_jobs_status_available_idx").on(
      table.status,
      table.availableAt,
    ),
  ],
);
