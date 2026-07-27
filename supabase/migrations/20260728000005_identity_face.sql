-- Face-match scores for identity documents (issue #32, selfie step).
--
-- Only derived numbers land here: the selfie, the document portrait and the
-- embeddings never leave the user's device, so no biometric identifiers are
-- stored — just similarity/liveness/antispoof outcomes for the review queue.

ALTER TABLE identity_documents
  ADD COLUMN face_checked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN face_doc_found BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN face_match_score INTEGER
    CHECK (face_match_score IS NULL OR face_match_score BETWEEN 0 AND 100),
  ADD COLUMN face_liveness_passed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN face_antispoof_score INTEGER
    CHECK (face_antispoof_score IS NULL OR face_antispoof_score BETWEEN 0 AND 100);
