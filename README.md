# Cloud Reporting Tool

A workflow application for imaging centres: staff create and assign scan orders, radiologists author and sign versioned reports, and patients receive secure access to report PDFs. Scan image storage and viewing are out of scope.

## Repository layout

- `frontend/` — React + TypeScript client.
- `backend/` — Node.js + Express + TypeScript API.
- `backend/src/` — API router and feature modules. Each feature keeps routes, handlers, and services together.
- `backend/shared/` — database schema/connection, table repositories, middleware, and common API response helpers.

The backend response contract is `{ meta: { status, message }, data }`. Paginated responses keep `data` as an array; the continuation cursor is returned in `X-Next-Cursor` when another page exists.

## Setup

Requirements: Node.js 22.18+ and PostgreSQL.

1. Copy `backend/.env.example` to `backend/.env` if one is not already present. Set a working local `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and the credentials for the selected PDF storage provider. Keep cloud keys outside the repository; `backend/.env` is ignored by Git.
2. Install dependencies from the repository root with `npm install`.
3. Apply the database migrations with `npm run db:migrate -w backend`.
4. Create local demo users and a CT Head report template with `npm run db:seed -w backend`. This command is guarded to run only when `NODE_ENV=development` and `ALLOW_DEMO_SEED=true`.
5. Start the API, PDF worker, and frontend in separate terminals with `npm run dev -w backend`, `npm run worker -w backend`, and `npm run dev -w frontend`.

The backend starts at `http://localhost:3000`; the esbuild-served frontend starts at `http://localhost:5173`. The seed command prints the demo facility ID. Local admin and front-desk accounts use the password `demo@123`; five radiologist accounts (`radiologist1@5cnetwork.com` through `radiologist5@5cnetwork.com`) use `Demo@123`. These credentials are for local development only.

## Frontend

The staff UI includes a role-aware worklist, patient directory and order intake, assignment and order details, report drafting/signing/amendments, PDF preview, and facility-admin pages for radiologist access and report templates. Login uses the facility ID printed by the seed command, configured in `frontend/.env` as `VITE_DEFAULT_FACILITY_ID`; it is not shown to staff. Start by copying `frontend/.env.example` to `frontend/.env`, replacing the facility ID placeholder, and restarting the frontend server. The API URL defaults to `http://localhost:3000/api/v1` and can be overridden with `VITE_API_BASE_URL`.

Staff access tokens are kept in the browser session and cleared when the session expires or the user signs out. Patient share links open the public report screen and exchange the share-link token for short-lived, report-scoped access.

## Backend API

- Staff sign-in: `POST /api/v1/auth/login`; use the returned bearer token for staff endpoints.
- Patients and radiologists: `/api/v1/patients` (front desk/facility admin) and `/api/v1/staff/radiologists`.
- Staff membership: `PATCH /api/v1/staff/:userId/status` (facility admin; `{ "active": false }` revokes access immediately).
- Orders: `/api/v1/orders`, including assignment, start, and cancellation actions.
- Report templates: `/api/v1/report-templates`.
- Reports: `/api/v1/orders/:orderId/report`, `/api/v1/orders/:orderId/report/status`, `/api/v1/reports/:reportId/draft`, `sign`, `amend`, and `versions`. The status endpoint exposes the latest version metadata to staff who prepare patient sharing, without exposing report content.
- PDFs and patient links: `/api/v1/report-versions/:versionId/pdf`, `/api/v1/report-versions/:versionId/share-links`, and `/api/v1/public/report-access/*`.

The PDF worker reads transactional outbox jobs and stores generated files according to `STORAGE_TO_USE`: `SUPABASE_STORAGE` uses `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_BUCKET_NAME`; `GCP_STORAGE` uses `GCS_BUCKET_NAME` and `GOOGLE_APPLICATION_CREDENTIALS`; `LOCAL_STORAGE` uses `PDF_STORAGE_DIR`. Replace the `SUPABASE_SECRET_KEY` placeholder in your ignored local `backend/.env` with the project secret from Supabase; do not share or commit it. Cloud buckets are accessed privately through the backend, not served as public files. PDFs include the supplied 5C Networks logo, hospital name, address, and phone at the top. This is a POC: use synthetic data only and review privacy, access controls, and operational requirements before handling real patient information. Never commit cloud keys.

## Design and project notes

- [Current system design](./docs/system-design.md) — implemented architecture, database model, roles, and application flow.
- [Architecture and delivery plan](./docs/architecture.md) — original assignment analysis, target design, performance goals, and implementation plan.
- [Current session summary](./docs/current-session-summary.md) — project handoff summary; not a verbatim chat transcript.
