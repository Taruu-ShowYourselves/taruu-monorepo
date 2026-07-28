-- Identity document verification (issue #32).
--
-- Privacy-by-design per PPL Amendment 13 + PPA ID-card guidance:
--   * NO document images are ever uploaded or stored — the scan runs on-device
--     and only extracted fields arrive here.
--   * The ID number is stored only as a server-keyed HMAC (dedup /
--     one-person-one-account) plus the last 2 digits for UI masking.
--   * Consent version + timestamp are recorded (§11 notice audit trail).
--   * Reads are per-user via RLS; all writes go through the service role.

CREATE TABLE identity_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL CHECK (document_type IN ('id_card', 'drivers_license')),

  -- HMAC-SHA256(id_number, server secret) — never the number itself.
  id_number_hash TEXT NOT NULL UNIQUE,
  id_number_last2 TEXT NOT NULL CHECK (id_number_last2 ~ '^[0-9]{2}$'),

  -- Fields extracted on-device and confirmed by the user.
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  document_expiry DATE NOT NULL,

  -- OCR provenance: drives auto-verify vs manual review.
  ocr_id_number_matched BOOLEAN NOT NULL DEFAULT FALSE,
  ocr_confidence INTEGER NOT NULL DEFAULT 0 CHECK (ocr_confidence BETWEEN 0 AND 100),
  ocr_fields_edited BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('verified', 'pending_review', 'rejected')),

  -- §11 consent audit trail.
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identity_documents_status ON identity_documents(status);

-- Cheap eligibility flag on users (avoids a join on every gate check).
ALTER TABLE users ADD COLUMN identity_verified_at TIMESTAMPTZ;

-- Access audit (Data Security Regulations: retain access logs ≥24 months).
CREATE TABLE identity_document_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (
    event IN ('submitted', 'auto_verified', 'queued_review', 'approved', 'rejected', 'deleted')
  ),
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identity_document_events_user ON identity_document_events(user_id, created_at);

-- RLS: deny-by-default; users may read only their own row; no client writes.
ALTER TABLE identity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_document_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own identity document"
  ON identity_documents
  FOR SELECT
  TO authenticated
  USING (user_id = public.user_id());

CREATE POLICY "Users can read own identity document events"
  ON identity_document_events
  FOR SELECT
  TO authenticated
  USING (user_id = public.user_id());
