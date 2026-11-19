# Cloud Reporting Tool: Architecture and Delivery Plan

## 1. Product understanding

This is an imaging-centre workflow system, not an image viewer or an automated diagnostic system. Its core path is:

1. Front-desk staff register or select a patient and create an imaging order (for example, CT brain).
2. Staff track orders in a searchable, filterable worklist and assign an eligible radiologist.
3. The radiologist drafts a report using a configured template, reviews it, and signs it.
4. The system preserves each signed report version and produces a PDF.
5. Staff share a time-limited, revocable link through which the patient can access the report.

The assignment explicitly excludes storing or viewing scan images; another system handles that. Do not imply that this application interprets images or generates diagnoses.

## 2. Scope and assumptions

### POC scope

- One deployable application with distinct frontend, API, and background-worker modules.
- Multiple facilities represented in the data model, with strict facility-level isolation from the beginning.
- Staff roles: front desk, radiologist, and facility administrator.
- Patient and order capture, assignment, worklist filters/search, report templates, report drafting/signing/amendment history, PDF generation, and secure patient links.
- Private PDF storage in Supabase Storage or Google Cloud Storage, selected by configuration, with authenticated/authorized retrieval; a local adapter remains available for development.
- Seed/demo users and data for end-to-end testing.

### Explicitly out of scope for the first cut

- DICOM/PACS integration, image ingestion/viewing, EHR/LIS integrations, scheduling/billing, email/SMS delivery, patient accounts, and automated clinical decision support.
- Production claims for regulatory compliance, high availability, or cloud-scale operations. These require additional operational, privacy, security, and clinical governance work.

### Scale targets from the assignment

- Worklist search over 1 million orders: p95 under 200 ms.
- Order/report/save/fetch APIs: p95 under 100 ms.
- PDF ready within 5 seconds after signing.
- Platform data model supports 500 imaging centres and 20,000 orders/day.
- No lost reports and no cross-patient disclosure.

These are targets to measure, not assumptions that a local POC has met them. Object storage removes local-filesystem coupling, but performance and availability targets still need to be measured.

## 3. Architecture

Use a **modular monolith**: a React SPA, one TypeScript/Express application, one PostgreSQL database, and a worker process using the same backend codebase. Keep module boundaries clear without introducing microservices or a message broker for the POC.

```text
Browser (staff / patient link)
          |
     React + TS
          | HTTPS / JSON
     Express API ------------------ Private Supabase / GCS bucket
          |                                ^
     PostgreSQL                            | generate / retrieve
       - app data                    PDF worker (same codebase)
       - audit events                       ^
       - transactional outbox --------------+
```

Repository layout (the initial scaffold follows this structure):

```text
frontend/               React + TypeScript application
backend/
  app.ts                Express application entry point
  src/
    router.ts            API version/router composition
    auth/
    staff/
    patients/
      route.ts           Patient CRUD route declarations
      handler.ts         HTTP validation, request/response mapping
      service.ts         Patient workflow/business rules
    orders/
    report-templates/
    reports/
    sharing/
    jobs/                 PDF worker and outbox polling
    ...                  One feature folder per domain
  assets/                 5C Networks PDF logo
  shared/
    middleware/          Authentication, authorization, validation, errors
    db/                  Connection, schema, versioned migrations
    repository/          Table-specific database access
    response_format.ts   Shared success/failure/paginated response helpers
    storage/              Supabase, GCS, and local PDF storage adapters
```

Each feature route maps HTTP methods to its handler; handlers validate and map request/response data, then call a service; services implement business rules and call repositories; repositories own database access. The API owns validation, workflow rules, authorization, persistence, audit recording, and PDF access. The frontend is a client of the API, not a trusted security boundary. Use parameterized queries (or an equivalent typed database layer) and versioned migrations.

All API responses use:

```json
{
  "meta": { "status": "success", "message": "Request successful" },
  "data": {}
}
```

Failures use `"status": "error"` and the same `meta`/`data` shape. For paginated list endpoints, `data` is an array and `X-Next-Cursor` carries the next cursor when more results exist; this preserves the requested response envelope without embedding page metadata in `data`.

## 4. Core data model

All facility-owned rows carry `facility_id`. Include it in unique constraints, indexes, and foreign-key relationships where practical to prevent accidental cross-facility joins. Resolve a user's facility membership from trusted server-side identity data; never accept an arbitrary facility ID as sufficient authorization.

| Entity | Important fields and purpose |
| --- | --- |
| `facilities` | Centre/tenant identity, address, and phone used in PDF headers. |
| `users`, `facility_memberships` | Staff identity, password hash, active state, facility membership, and role. A user may belong to more than one facility. |
| `patients` | Facility-scoped demographics and local medical-record identifier. Records are archived rather than physically deleted. |
| `orders` | Patient, modality, procedure, status, priority, creator, assignee, timestamps, and accession identifier. |
| `report_templates` | Facility-scoped template name/version and structured required sections. |
| `reports` | One mutable draft per order and the latest version number. |
| `report_versions` | Immutable signed content, template, author, sequence, signature metadata, PDF state/path/checksum. |
| `patient_share_links` | Hash of a random bearer token, report/version scope, expiry, revocation, creator, and last access. Store no raw token. |
| `audit_events` | Actor, facility, action, resource, timestamp, and non-sensitive metadata. Database triggers prevent updates/deletes. |
| `outbox_jobs` | Transactionally recorded PDF-generation work, with status, attempts, and idempotency metadata. |

Use database constraints for required relationships, uniqueness, valid statuses, and version sequence uniqueness. Store dates as UTC timestamps. Define patient duplicate matching explicitly (for example, facility plus MRN) rather than silently merging records.

## 5. Workflow and report integrity

Suggested order lifecycle: `unassigned -> assigned -> in_progress -> reported`; cancellation is an audited transition where allowed. A report has a draft state until signed. Signing creates an immutable version and its signature metadata. An amendment creates a new version linked to the preceding version and records its author and reason; it does not edit history. Make transitions explicit in backend commands and reject invalid transitions.

The sign operation should run in a database transaction:

1. Verify the caller is an active radiologist assigned to the order (or has an explicitly privileged role), and the report is in a signable state.
2. Persist an immutable signed version and update the order/report state.
3. Add a PDF-generation job to the outbox and an audit event in the same transaction.

The worker claims pending jobs safely, generates the PDF with the facility logo/contact header, uploads it to the configured private Supabase or GCS bucket (or local adapter), then records the object key/checksum and ready state. Retries must be idempotent and failures visible to staff/operations; do not report a PDF as ready before it exists. For the POC, a PostgreSQL-backed worker/outbox avoids adding a broker while keeping the signing transaction durable. Monitor the time from signing commit to PDF-ready and target under 5 seconds.

## 6. API outline

Use `/api/v1`, JSON, consistent error responses, schema validation at request boundaries, and cursor pagination for the worklist.

| Area | Example endpoints |
| --- | --- |
| Authentication | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Authentication | `POST /auth/login`, `GET /auth/me` |
| Staff and patients | `GET /staff/radiologists`, `/patients` CRUD |
| Worklist | `GET /orders?status=&assigneeId=&modality=&q=&cursor=&limit=` |
| Orders | `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/assignment`, `POST /orders/:id/start`, `POST /orders/:id/cancel` |
| Templates | `GET /report-templates`, `POST /report-templates` (facility admin) |
| Reports | `POST/GET /orders/:id/report`, `PUT /reports/:id/draft`, `POST /reports/:id/sign`, `POST /reports/:id/amend`, `GET /reports/:id/versions` |
| PDFs | `GET /report-versions/:id/pdf` (staff authorization required). |
| Patient sharing | `POST /report-versions/:id/share-links`, `DELETE /share-links/:id`, `POST /public/report-access/exchange`, then scoped PDF retrieval. |

The public share flow must not depend on staff JWTs. Generate high-entropy tokens, store only a one-way hash, scope each token to a specific report/version, set an expiry, support revocation, rate-limit access, and audit successful/failed access without logging the token. Avoid placing sensitive report data in URLs. Use no-store caching and a restrictive referrer policy on patient pages. A future production implementation should use a carefully reviewed token-exchange/session design and secure delivery channel.

## 7. Security, privacy, and reliability

- Authenticate staff with password hashes (Argon2id or bcrypt) and short-lived JWTs. Prefer `HttpOnly`, `Secure`, `SameSite` cookies for browser tokens; protect state-changing requests against CSRF if cookies are used. Keep secrets in environment configuration, never source control.
- Enforce role checks and facility membership on every API operation, including PDF access and background jobs. Return non-enumerating responses for public tokens.
- Use parameterized queries, input validation, safe output encoding, request size limits, and rate limits on authentication and public-link routes.
- Audit assignment changes, report drafts/signatures/amendments, link creation/revocation, and patient report access. Keep audit records append-only at the application level.
- Keep PDFs private, use unpredictable storage keys, prevent path traversal, and serve only through authorization-checked routes. Exclude runtime PDFs, credentials, and real patient information from Git and logs.
- Use database transactions and backups. Test restore procedures; a backup that has not been restored is not a verified recovery plan.
- Configure HTTPS, secure headers, restricted CORS, and dependency updates in any deployed environment. Production use with real patient information requires a jurisdiction-specific privacy/security assessment and appropriate controls beyond this POC.

## 8. Performance approach and proof

- Worklist query: select only needed columns; filter by `facility_id` and status/assignee/modality; order deterministically; use keyset/cursor pagination instead of large offsets.
- Add indexes based on actual filters, such as `(facility_id, status, created_at DESC, id)` and `(facility_id, assigned_radiologist_id, status, created_at DESC, id)`. Add a facility-scoped patient identifier index. For name/MRN/order search, choose indexed exact/prefix or PostgreSQL trigram search based on the implemented UX; do not use an unindexed `%term%` scan at million-row scale.
- Avoid N+1 API queries and keep PDF generation out of interactive list/fetch requests.
- Seed synthetic data (never real patient data) to at least 1 million orders. Record database and API timings for representative searches across common filters and search terms, including warm-up and pagination. Report p50/p95/p99, sample count, hardware/runtime, and dataset shape.
- Measure API p95 separately from end-to-end browser latency. Measure PDF-ready time from successful sign transaction to persisted, retrievable PDF. Include the exact command or repeatable test procedure with the results.
- Use `EXPLAIN (ANALYZE, BUFFERS)` to diagnose query plans. Add partitioning or more complex search only if measurements demonstrate a need.

Do not present results from a tiny development dataset as evidence of meeting the 1-million-order target. If local hardware cannot meet the target, report the measured result and its environment honestly.

## 9. Implementation phases

The assignment suggests about 8 hours, so prioritize one complete workflow over broad polish:

1. **Foundation (about 1 hour):** initialize TypeScript frontend/backend, configuration, PostgreSQL, migrations, seed data, shared error/validation conventions.
2. **Identity and isolation (about 1 hour):** login, password hashing, JWT/cookie handling, roles, facility membership, authorization tests.
3. **Order workflow (about 2 hours):** patient/order creation, assignment, valid state changes, worklist filters/search and cursor pagination.
4. **Reports and PDF (about 2 hours):** template-backed editor, draft save, signing, immutable version/amendment history, outbox worker, private object storage.
5. **Patient sharing (about 1 hour):** expiring/revocable hashed links, safe patient page/PDF retrieval, access audit.
6. **Hardening and evidence (about 1 hour):** end-to-end happy path, negative authorization tests, synthetic load/latency measurement, setup and design documentation.

If time is constrained, preserve the complete order-to-signed-PDF workflow and its authorization/version-history guarantees; defer styling and external integrations. Do not defer facility scoping or immutable signed history.

## 10. Repository plan and acceptance checklist

The initial repository scaffold now follows the layout in section 3. Keep local secrets, generated PDFs, and database artifacts out of version control.

The POC is ready to demonstrate when:

- Front desk can create an order, find it in the worklist, and assign it to a radiologist.
- The assigned radiologist can draft from a template, save, sign, and amend; earlier signed versions remain retrievable and unchanged.
- A PDF becomes downloadable after signing, and the patient can access the intended report through a valid link.
- Expired/revoked links and unauthorized roles/facilities cannot retrieve patient/report data.
- The main workflow and key negative authorization cases have automated tests.
- Search/API/PDF performance results are measured and documented with a repeatable method; unmet targets are stated, not hidden.
- The README explains how to run the app, configure the database, seed demo data, run tests, and find the architecture/performance notes.

Before moving from local POC to cloud operation, replace local file storage with a private object-storage adapter (for example, GCP Cloud Storage), add deployment-managed secrets, TLS, backups/restore, monitoring, and an operational review of tenant isolation and patient-link handling.
