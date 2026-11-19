CREATE TYPE scan_modality AS ENUM ('XR', 'CT', 'MRI', 'PET', 'US', 'OTHER');
CREATE TYPE order_priority AS ENUM ('routine', 'urgent', 'stat');
CREATE TYPE order_status AS ENUM ('unassigned', 'assigned', 'in_progress', 'reported', 'cancelled');
CREATE TYPE report_status AS ENUM ('draft', 'signed');
CREATE TYPE pdf_status AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE patients ADD COLUMN deleted_at timestamptz(3);
CREATE UNIQUE INDEX patients_facility_id_unique ON patients (facility_id, id);
CREATE INDEX patients_mrn_trgm_idx ON patients USING gin (medical_record_number gin_trgm_ops);
CREATE INDEX patients_first_name_trgm_idx ON patients USING gin (first_name gin_trgm_ops);
CREATE INDEX patients_last_name_trgm_idx ON patients USING gin (last_name gin_trgm_ops);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  patient_id uuid NOT NULL,
  accession_number varchar(64) NOT NULL,
  modality scan_modality NOT NULL,
  procedure_name varchar(200) NOT NULL,
  priority order_priority NOT NULL DEFAULT 'routine',
  status order_status NOT NULL DEFAULT 'unassigned',
  created_by uuid NOT NULL,
  assigned_radiologist_id uuid,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT orders_facility_patient_fk
    FOREIGN KEY (facility_id, patient_id) REFERENCES patients (facility_id, id),
  CONSTRAINT orders_facility_creator_fk
    FOREIGN KEY (facility_id, created_by)
    REFERENCES facility_memberships (facility_id, user_id),
  CONSTRAINT orders_facility_assignee_fk
    FOREIGN KEY (facility_id, assigned_radiologist_id)
    REFERENCES facility_memberships (facility_id, user_id)
);
CREATE UNIQUE INDEX orders_facility_accession_unique
  ON orders (facility_id, accession_number);
CREATE UNIQUE INDEX orders_facility_id_unique ON orders (facility_id, id);
CREATE INDEX orders_facility_status_created_idx
  ON orders (facility_id, status, created_at DESC, id DESC);
CREATE INDEX orders_facility_assignee_status_created_idx
  ON orders (facility_id, assigned_radiologist_id, status, created_at DESC, id DESC);
CREATE INDEX orders_accession_trgm_idx
  ON orders USING gin (accession_number gin_trgm_ops);

CREATE TABLE report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  name varchar(120) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  sections jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT report_templates_facility_creator_fk
    FOREIGN KEY (facility_id, created_by)
    REFERENCES facility_memberships (facility_id, user_id)
);
CREATE UNIQUE INDEX report_templates_facility_name_version_unique
  ON report_templates (facility_id, name, version);
CREATE UNIQUE INDEX report_templates_facility_id_unique
  ON report_templates (facility_id, id);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  order_id uuid NOT NULL,
  template_id uuid NOT NULL,
  draft_content jsonb NOT NULL DEFAULT '{}',
  draft_amendment_reason text,
  status report_status NOT NULL DEFAULT 'draft',
  latest_version_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT reports_facility_order_fk
    FOREIGN KEY (facility_id, order_id) REFERENCES orders (facility_id, id),
  CONSTRAINT reports_facility_template_fk
    FOREIGN KEY (facility_id, template_id) REFERENCES report_templates (facility_id, id)
);
CREATE UNIQUE INDEX reports_facility_order_unique ON reports (facility_id, order_id);
CREATE UNIQUE INDEX reports_facility_id_unique ON reports (facility_id, id);

CREATE TABLE report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  report_id uuid NOT NULL,
  template_id uuid NOT NULL,
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  amendment_reason text,
  signed_by uuid NOT NULL,
  signed_at timestamptz(3) NOT NULL DEFAULT now(),
  pdf_status pdf_status NOT NULL DEFAULT 'pending',
  pdf_relative_path text,
  pdf_sha256 varchar(64),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT report_versions_facility_report_fk
    FOREIGN KEY (facility_id, report_id) REFERENCES reports (facility_id, id),
  CONSTRAINT report_versions_facility_template_fk
    FOREIGN KEY (facility_id, template_id) REFERENCES report_templates (facility_id, id),
  CONSTRAINT report_versions_facility_signer_fk
    FOREIGN KEY (facility_id, signed_by)
    REFERENCES facility_memberships (facility_id, user_id)
);
CREATE UNIQUE INDEX report_versions_facility_report_number_unique
  ON report_versions (facility_id, report_id, version_number);
CREATE UNIQUE INDEX report_versions_facility_id_unique
  ON report_versions (facility_id, id);

CREATE TABLE patient_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  report_version_id uuid NOT NULL,
  token_hash varchar(64) NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  revoked_at timestamptz(3),
  last_access_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT patient_share_links_facility_version_fk
    FOREIGN KEY (facility_id, report_version_id)
    REFERENCES report_versions (facility_id, id),
  CONSTRAINT patient_share_links_facility_creator_fk
    FOREIGN KEY (facility_id, created_by)
    REFERENCES facility_memberships (facility_id, user_id)
);
CREATE UNIQUE INDEX patient_share_links_token_hash_unique
  ON patient_share_links (token_hash);
CREATE UNIQUE INDEX patient_share_links_facility_id_unique
  ON patient_share_links (facility_id, id);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  actor_user_id uuid,
  action varchar(80) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_facility_actor_fk
    FOREIGN KEY (facility_id, actor_user_id)
    REFERENCES facility_memberships (facility_id, user_id)
);
CREATE INDEX audit_events_facility_created_idx
  ON audit_events (facility_id, created_at DESC);

CREATE TABLE outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  job_type varchar(80) NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz(3) NOT NULL DEFAULT now(),
  locked_at timestamptz(3),
  completed_at timestamptz(3),
  last_error text,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX outbox_jobs_status_available_idx ON outbox_jobs (status, available_at);

CREATE FUNCTION protect_report_version() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Signed report versions cannot be deleted';
  END IF;
  IF (NEW.id, NEW.facility_id, NEW.report_id, NEW.template_id, NEW.version_number,
      NEW.content, NEW.amendment_reason, NEW.signed_by, NEW.signed_at, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.facility_id, OLD.report_id, OLD.template_id, OLD.version_number,
      OLD.content, OLD.amendment_reason, OLD.signed_by, OLD.signed_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Signed report content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER report_versions_are_immutable
  BEFORE UPDATE OR DELETE ON report_versions
  FOR EACH ROW EXECUTE FUNCTION protect_report_version();

CREATE FUNCTION protect_audit_event() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_events_are_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION protect_audit_event();
