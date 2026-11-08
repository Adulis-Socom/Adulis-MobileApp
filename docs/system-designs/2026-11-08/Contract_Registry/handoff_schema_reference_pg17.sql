-- PostgreSQL 17 synthetic design fixture, NOT an executed production migration.
-- Minimal parent stubs below are fixture-only; integration uses actual owners.
-- No provider permission, legal approval or cross-table CHECK is asserted.
CREATE SCHEMA accounts;
CREATE SCHEMA operators;
CREATE SCHEMA core;
CREATE SCHEMA fulfilment;
CREATE TABLE accounts.account (id uuid PRIMARY KEY);
CREATE TABLE operators.operator_account (id uuid PRIMARY KEY);
CREATE TABLE core.seller (id uuid PRIMARY KEY);
CREATE TABLE core.seller_order (
  id uuid PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES accounts.account(id),
  UNIQUE (id, buyer_account_id)
);
CREATE TABLE fulfilment.delivery_assignment (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES core.seller_order(id),
  UNIQUE (id, order_id)
);
CREATE TABLE core.delivery_recipient_authorization (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES core.seller_order(id),
  buyer_account_id uuid NOT NULL REFERENCES accounts.account(id),
  recipient_name text NOT NULL,
  recipient_phone_e164 text NOT NULL,
  accepted_ordinary_account_id uuid REFERENCES accounts.account(id),
  phone_verified_at timestamptz,
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED','USED','EXPIRED')),
  created_at timestamptz NOT NULL,
  revoked_at timestamptz,
  used_at timestamptz,
  UNIQUE (id, order_id),
  FOREIGN KEY (order_id, buyer_account_id)
    REFERENCES core.seller_order(id, buyer_account_id)
);
CREATE UNIQUE INDEX delivery_recipient_one_active_order
  ON core.delivery_recipient_authorization(order_id) WHERE status = 'ACTIVE';
CREATE INDEX delivery_recipient_order_status_lookup
  ON core.delivery_recipient_authorization(order_id, status);

CREATE TABLE core.handoff (
  id uuid PRIMARY KEY,
  public_ref text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES core.seller_order(id),
  market_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('PICKUP','DELIVERY')),
  fulfilment_mode text NOT NULL,
  presenter_principal_type text NOT NULL
    CHECK (presenter_principal_type = 'ORDINARY_ACCOUNT'),
  presenter_ordinary_account_id uuid NOT NULL REFERENCES accounts.account(id),
  presenter_seller_id uuid REFERENCES core.seller(id),
  presenter_courier_assignment_id uuid,
  intended_recipient_type text NOT NULL
    CHECK (intended_recipient_type IN ('BUYER','DELEGATE','COURIER')),
  buyer_account_id uuid REFERENCES accounts.account(id),
  delegated_recipient_authorization_id uuid,
  recipient_courier_assignment_id uuid,
  status text NOT NULL
    CHECK (status IN ('PENDING','VERIFIED','EXPIRED','LOCKED','CANCELLED','REVOKED')),
  meeting_started_at timestamptz,
  verified_at timestamptz,
  verification_method text CHECK (verification_method IN ('QR','OTP','MANUAL')),
  policy_version text NOT NULL,
  UNIQUE (id, order_id),
  UNIQUE (order_id, stage, fulfilment_mode),
  FOREIGN KEY (presenter_courier_assignment_id, order_id)
    REFERENCES fulfilment.delivery_assignment(id, order_id),
  FOREIGN KEY (recipient_courier_assignment_id, order_id)
    REFERENCES fulfilment.delivery_assignment(id, order_id),
  FOREIGN KEY (delegated_recipient_authorization_id, order_id)
    REFERENCES core.delivery_recipient_authorization(id, order_id),
  FOREIGN KEY (order_id, buyer_account_id)
    REFERENCES core.seller_order(id, buyer_account_id),
  CHECK (num_nonnulls(presenter_seller_id,presenter_courier_assignment_id) = 1),
  CHECK (
    (intended_recipient_type = 'BUYER' AND buyer_account_id IS NOT NULL
     AND delegated_recipient_authorization_id IS NULL
     AND recipient_courier_assignment_id IS NULL)
    OR (intended_recipient_type = 'DELEGATE' AND buyer_account_id IS NULL
     AND delegated_recipient_authorization_id IS NOT NULL
     AND recipient_courier_assignment_id IS NULL)
    OR (intended_recipient_type = 'COURIER' AND buyer_account_id IS NULL
     AND delegated_recipient_authorization_id IS NULL
     AND recipient_courier_assignment_id IS NOT NULL)
  ),
  CHECK (stage <> 'PICKUP' OR
    (presenter_seller_id IS NOT NULL AND intended_recipient_type = 'COURIER')),
  CHECK (stage <> 'DELIVERY' OR intended_recipient_type IN ('BUYER','DELEGATE')),
  CHECK (status <> 'VERIFIED' OR
    (verified_at IS NOT NULL AND verification_method IS NOT NULL))
);
CREATE INDEX handoff_order_stage_lookup ON core.handoff(order_id, stage);
CREATE INDEX handoff_presenter_assignment_status_lookup
  ON core.handoff(presenter_courier_assignment_id, status)
  WHERE presenter_courier_assignment_id IS NOT NULL;
CREATE INDEX handoff_recipient_assignment_status_lookup
  ON core.handoff(recipient_courier_assignment_id, status)
  WHERE recipient_courier_assignment_id IS NOT NULL;

CREATE TABLE core.handoff_credential (
  id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL REFERENCES core.handoff(id),
  type text NOT NULL CHECK (type IN ('QR','OTP')),
  purpose text NOT NULL,
  generation integer NOT NULL CHECK (generation >= 0),
  token_id text NOT NULL UNIQUE,
  credential_digest text NOT NULL,
  key_id text,
  recipient_binding_ref text NOT NULL,
  presenter_binding_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','USED','EXPIRED','REVOKED')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts > 0),
  CHECK (expires_at >= issued_at),
  CHECK (attempt_count <= max_attempts),
  UNIQUE (id, handoff_id)
);
CREATE INDEX handoff_credential_expiry_status_lookup
  ON core.handoff_credential(expires_at, status);
CREATE UNIQUE INDEX handoff_one_active_credential_type
  ON core.handoff_credential(handoff_id, type) WHERE status = 'ACTIVE';

CREATE TABLE core.handoff_evidence (
  id uuid PRIMARY KEY,
  handoff_id uuid NOT NULL UNIQUE,
  order_id uuid NOT NULL,
  market_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('QR','OTP','MANUAL')),
  presenter_ordinary_account_id uuid NOT NULL REFERENCES accounts.account(id),
  presenter_seller_id uuid REFERENCES core.seller(id),
  presenter_courier_assignment_id uuid,
  recipient_class text NOT NULL CHECK (recipient_class IN ('BUYER','DELEGATE','COURIER')),
  recipient_buyer_account_id uuid REFERENCES accounts.account(id),
  recipient_delegate_authorization_id uuid,
  recipient_courier_assignment_id uuid,
  credential_id uuid,
  operator_case_id uuid,
  decided_by_operator_account_id uuid REFERENCES operators.operator_account(id),
  approval_reference text,
  reviewer_reference text,
  reason_code text,
  policy_version text NOT NULL,
  verified_at timestamptz NOT NULL,
  request_id text NOT NULL,
  FOREIGN KEY (handoff_id, order_id) REFERENCES core.handoff(id, order_id),
  FOREIGN KEY (credential_id, handoff_id)
    REFERENCES core.handoff_credential(id, handoff_id),
  FOREIGN KEY (presenter_courier_assignment_id, order_id)
    REFERENCES fulfilment.delivery_assignment(id, order_id),
  FOREIGN KEY (recipient_courier_assignment_id, order_id)
    REFERENCES fulfilment.delivery_assignment(id, order_id),
  FOREIGN KEY (recipient_delegate_authorization_id, order_id)
    REFERENCES core.delivery_recipient_authorization(id, order_id),
  CHECK (num_nonnulls(presenter_seller_id,presenter_courier_assignment_id) = 1),
  CHECK (
    (recipient_class = 'BUYER' AND recipient_buyer_account_id IS NOT NULL
     AND recipient_delegate_authorization_id IS NULL
     AND recipient_courier_assignment_id IS NULL)
    OR (recipient_class = 'DELEGATE' AND recipient_buyer_account_id IS NULL
     AND recipient_delegate_authorization_id IS NOT NULL
     AND recipient_courier_assignment_id IS NULL)
    OR (recipient_class = 'COURIER' AND recipient_buyer_account_id IS NULL
     AND recipient_delegate_authorization_id IS NULL
     AND recipient_courier_assignment_id IS NOT NULL)
  ),
  CHECK (
    (method = 'MANUAL' AND decided_by_operator_account_id IS NOT NULL
      AND operator_case_id IS NOT NULL AND credential_id IS NULL
      AND reason_code IS NOT NULL)
    OR (method IN ('QR','OTP') AND decided_by_operator_account_id IS NULL
      AND credential_id IS NOT NULL)
  )
);
-- All cross-row current Seller/team/assignment/Market/payment/recipient checks,
-- stage + fulfilment-mode direction, generation replacement, Manual governance,
-- expiry/redemption and evidence equality require the locked Handoff owner UoW.
-- These lookup indexes never confer authority. No ON DELETE CASCADE is added.
