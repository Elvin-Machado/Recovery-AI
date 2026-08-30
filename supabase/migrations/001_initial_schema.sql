BEGIN;

-- ============================================================
-- 1. WEBHOOK EVENTS
-- Stores the original events received from Razorpay.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id TEXT NOT NULL UNIQUE,

    event_type TEXT NOT NULL,

    payload JSONB NOT NULL,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed BOOLEAN NOT NULL DEFAULT FALSE
);


-- ============================================================
-- 2. CUSTOMERS
-- Stores merchant/customer information needed for recovery.
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    email TEXT,

    phone TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. REVENUE EVENTS
-- Represents revenue that is potentially at risk.
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id UUID
        REFERENCES customers(id)
        ON DELETE SET NULL,

    source_webhook_id UUID
        REFERENCES webhook_events(id)
        ON DELETE SET NULL,

    event_type TEXT NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,

    currency TEXT NOT NULL DEFAULT 'INR',

    risk_category TEXT,

    status TEXT NOT NULL DEFAULT 'detected',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. DIAGNOSES
-- Stores the diagnosis produced by our intelligence layer.
-- ============================================================

CREATE TABLE IF NOT EXISTS diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    revenue_event_id UUID NOT NULL
        REFERENCES revenue_events(id)
        ON DELETE CASCADE,

    category TEXT NOT NULL,

    confidence NUMERIC(5, 4),

    reason TEXT,

    model_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 5. DECISIONS
-- Stores the recommended recovery decision.
-- ============================================================

CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    revenue_event_id UUID NOT NULL
        REFERENCES revenue_events(id)
        ON DELETE CASCADE,

    diagnosis_id UUID
        REFERENCES diagnoses(id)
        ON DELETE SET NULL,

    recommended_action TEXT NOT NULL,

    confidence NUMERIC(5, 4),

    reason TEXT,

    status TEXT NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. ACTIONS
-- Stores the action that was actually attempted.
-- ============================================================

CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    decision_id UUID NOT NULL
        REFERENCES decisions(id)
        ON DELETE CASCADE,

    action_type TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending',

    executed_at TIMESTAMPTZ,

    metadata JSONB
);


-- ============================================================
-- 7. RECOVERY RESULTS
-- Stores the outcome of an executed recovery action.
-- ============================================================

CREATE TABLE IF NOT EXISTS recovery_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    action_id UUID NOT NULL UNIQUE
        REFERENCES actions(id)
        ON DELETE CASCADE,

    success BOOLEAN NOT NULL,

    recovered_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

    currency TEXT NOT NULL DEFAULT 'INR',

    result_code TEXT,

    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. AUDIT LOGS
-- Stores the complete decision/action trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    revenue_event_id UUID
        REFERENCES revenue_events(id)
        ON DELETE SET NULL,

    action TEXT NOT NULL,

    actor_type TEXT NOT NULL,

    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- Improve queries that our dashboard and agents will use often.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_revenue_events_customer_id
    ON revenue_events(customer_id);

CREATE INDEX IF NOT EXISTS idx_revenue_events_status
    ON revenue_events(status);

CREATE INDEX IF NOT EXISTS idx_revenue_events_created_at
    ON revenue_events(created_at);

CREATE INDEX IF NOT EXISTS idx_diagnoses_revenue_event_id
    ON diagnoses(revenue_event_id);

CREATE INDEX IF NOT EXISTS idx_decisions_revenue_event_id
    ON decisions(revenue_event_id);

CREATE INDEX IF NOT EXISTS idx_actions_decision_id
    ON actions(decision_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_revenue_event_id
    ON audit_logs(revenue_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at);


COMMIT;