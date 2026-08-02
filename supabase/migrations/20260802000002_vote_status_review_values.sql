-- Review states for the space-admin proposal queue.
--
-- This file contains ALTER TYPE and nothing else, on purpose. PostgreSQL
-- refuses to USE a new enum label until the adding transaction has committed
-- ("unsafe use of new value"), and the failure rolls the ADD VALUE back too.
-- Everything that references these labels lives in 20260802000003.
--
-- Every anchor is 'pending', a label that predates this migration. Chaining
-- each label onto the one before it would make every statement name a label
-- added moments earlier in the same transaction, and RESEARCH's probe only
-- established that statements referencing PRE-EXISTING labels are safe. A catalog neighbour
-- lookup is very likely not a "use" of the new value, but no verify in this
-- phase applies the migration, so a failure would surface only at 05-16's
-- manual step. Anchoring all four on 'pending' costs nothing: each insertion
-- lands immediately before 'pending', so the resulting sort order is still
-- draft < in_review < changes_requested < rejected < pending -- and nothing in
-- this phase orders by status anyway.
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'draft'             BEFORE 'pending';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'in_review'         BEFORE 'pending';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'changes_requested' BEFORE 'pending';
ALTER TYPE vote_status ADD VALUE IF NOT EXISTS 'rejected'          BEFORE 'pending';
