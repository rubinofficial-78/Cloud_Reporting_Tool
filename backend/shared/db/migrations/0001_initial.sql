CREATE TYPE membership_role AS ENUM ('front_desk', 'radiologist', 'facility_admin');

CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash varchar(255) NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE facility_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role membership_role NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX facility_memberships_facility_user_unique
  ON facility_memberships (facility_id, user_id);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  medical_record_number varchar(64) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  date_of_birth date,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX patients_facility_mrn_unique
  ON patients (facility_id, medical_record_number);
CREATE INDEX patients_facility_created_id_idx
  ON patients (facility_id, created_at, id);
