BEGIN;

-- ============================================================
-- 003_PROMISES_SCHEMA.sql
-- Phase 12H: Promise-to-Pay Tracker
--
-- The existing revenue_events schema cannot cleanly represent
-- promise lifecycle fields (promise_date, amount_paid, remaining
-- amount, promise-specific state transitions). A dedicated minimal
-- promises table is required.
--
-- This table is additive and does NOT modify any existing table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Deterministic identifier used for idempotency
    promise_ref TEXT NOT NULL UNIQUE,

    -- Reference to the source receivable / invoice
    invoice_ref TEXT NOT NULL,

    customer_name TEXT NOT NULL,
    customer_email TEXT,

    -- Monetary tracking (never hardcoded, always from simulator input)
    promised_amount NUMERIC(12,2) NOT NULL,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Simulated/actual promise date (ISO date string)
    promise_date TEXT NOT NULL,

    -- PROMISE_PENDING | PARTIALLY_FULFILLED | FULFILLED | BROKEN | CANCELLED | ESCALATED
    status TEXT NOT NULL DEFAULT 'PROMISE_PENDING',

    escalation_stage INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to enforce one active promise per invoice context
CREATE INDEX IF NOT EXISTS promises_invoice_idx ON public.promises (invoice_ref);
CREATE INDEX IF NOT EXISTS promises_status_idx ON public.promises (status);
CREATE INDEX IF NOT EXISTS promises_ref_idx ON public.promises (promise_ref);

-- Enforce metric consistency: paid amount can never exceed promised amount
CREATE OR REPLACE FUNCTION enforce_promise_paid_bounds()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.amount_paid > NEW.promised_amount THEN
        RAISE EXCEPTION 'amount_paid (%) cannot exceed promised_amount (%)',
            NEW.amount_paid, NEW.promised_amount;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promise_paid_bounds ON public.promises;
CREATE TRIGGER trg_promise_paid_bounds
    BEFORE INSERT OR UPDATE ON public.promises
    FOR EACH ROW EXECUTE FUNCTION enforce_promise_paid_bounds();

COMMIT;
