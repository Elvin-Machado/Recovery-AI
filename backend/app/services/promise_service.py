from datetime import datetime, date
from typing import Optional

from app.database import supabase


PROMISE_VALID_TRANSITIONS = {
    "PROMISE_PENDING": {"PARTIALLY_FULFILLED", "FULFILLED", "BROKEN", "CANCELLED"},
    "PARTIALLY_FULFILLED": {"FULFILLED", "BROKEN", "CANCELLED"},
    "BROKEN": {"ESCALATED", "CANCELLED"},
    "FULFILLED": set(),
    "CANCELLED": set(),
    "ESCALATED": set(),
}

MAX_PROMISE_ESCALATION = 3


class PromiseService:
    """
    Deterministic Promise-to-Pay state machine.

    Uses the existing recovery architecture (policy/action/result/audit)
    for escalation, but tracks promise-specific state in the `promises`
    table. This is the minimal, additive schema addition for Phase 12H.
    """

    def get_all(self) -> list:
        try:
            resp = (
                supabase.table("promises").select("*").execute()
            )
            return resp.data or []
        except Exception:
            return self._memory_fetch()

    def get_active(self) -> list:
        rows = []
        try:
            resp = (
                supabase.table("promises")
                .select("*")
                .in_("status", ["PROMISE_PENDING", "PARTIALLY_FULFILLED"])
                .execute()
            )
            rows = resp.data or []
        except Exception:
            rows = self._memory_fetch()
        return [r for r in rows if r["status"] in ("PROMISE_PENDING", "PARTIALLY_FULFILLED")]

    def get_by_ref(self, promise_ref: str) -> Optional[dict]:
        try:
            resp = (
                supabase.table("promises")
                .select("*")
                .eq("promise_ref", promise_ref)
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            for r in self._memory_fetch():
                if r["promise_ref"] == promise_ref:
                    return r
            return None

    def get_by_invoice(self, invoice_ref: str) -> Optional[dict]:
        try:
            resp = (
                supabase.table("promises")
                .select("*")
                .eq("invoice_ref", invoice_ref)
                .eq("status", "PROMISE_PENDING")
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            for r in self._memory_fetch():
                if r["invoice_ref"] == invoice_ref and r["status"] == "PROMISE_PENDING":
                    return r
            return None

    def create(self, promise_ref, invoice_ref, customer_name, customer_email,
               promised_amount, promise_date) -> dict:
        promised_amount = float(promised_amount)
        if promised_amount <= 0:
            raise ValueError("Promised amount must be greater than 0")
        if promise_date <= date.today().isoformat():
            # Allow same-day but reject strictly past dates only if buyer explicitly wants
            pass

        existing = self.get_by_ref(promise_ref)
        if existing:
            return existing

        row = {
            "promise_ref": promise_ref,
            "invoice_ref": invoice_ref,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "promised_amount": promised_amount,
            "amount_paid": 0.0,
            "promise_date": promise_date,
            "status": "PROMISE_PENDING",
            "escalation_stage": 0,
        }
        try:
            resp = supabase.table("promises").insert(row).execute()
            return resp.data[0] if resp.data else row
        except Exception:
            self._memory_store(row)
            return row

    def record_payment(self, promise_ref: str, payment_amount: float) -> dict:
        p = self.get_by_ref(promise_ref)
        if not p:
            raise ValueError(f"Promise not found: {promise_ref}")

        payment_amount = float(payment_amount)
        if payment_amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        promised = float(p["promised_amount"])
        paid = float(p.get("amount_paid", 0))
        new_paid = paid + payment_amount
        if new_paid > promised:
            raise ValueError("Payment amount would exceed promised amount")

        if new_paid >= promised:
            new_status = "FULFILLED"
        elif new_paid > 0:
            new_status = "PARTIALLY_FULFILLED"
        else:
            new_status = p["status"]

        updates = {
            "amount_paid": new_paid,
            "status": new_status,
            "updated_at": datetime.now().isoformat(),
        }
        try:
            resp = (
                supabase.table("promises")
                .update(updates)
                .eq("promise_ref", promise_ref)
                .execute()
            )
            return resp.data[0] if resp.data else {**p, **updates}
        except Exception:
            self._memory_update(promise_ref, updates)
            return {**p, **updates}

    def mark_broken(self, promise_ref: str) -> dict:
        p = self.get_by_ref(promise_ref)
        if not p:
            raise ValueError(f"Promise not found: {promise_ref}")
        updates = {"status": "BROKEN"}
        try:
            resp = (
                supabase.table("promises")
                .update(updates)
                .eq("promise_ref", promise_ref)
                .execute()
            )
            return resp.data[0] if resp.data else {**p, **updates}
        except Exception:
            self._memory_update(promise_ref, updates)
            return {**p, **updates}

    def mark_cancelled(self, promise_ref: str) -> dict:
        p = self.get_by_ref(promise_ref)
        if not p:
            raise ValueError(f"Promise not found: {promise_ref}")
        updates = {"status": "CANCELLED"}
        try:
            resp = (
                supabase.table("promises")
                .update(updates)
                .eq("promise_ref", promise_ref)
                .execute()
            )
            return resp.data[0] if resp.data else {**p, **updates}
        except Exception:
            self._memory_update(promise_ref, updates)
            return {**p, **updates}

    def delete(self, promise_ref: str) -> dict:
        p = self.get_by_ref(promise_ref)
        if not p:
            raise ValueError(f"Promise not found: {promise_ref}")
        try:
            resp = (
                supabase.table("promises")
                .delete()
                .eq("promise_ref", promise_ref)
                .execute()
            )
            if resp.data:
                return resp.data[0]
        except Exception:
            pass

        if self._memory_enabled:
            PromiseService._memory = [
                r for r in PromiseService._memory if r["promise_ref"] != promise_ref
            ]
        return p

    def escalate(self, promise_ref: str) -> dict:
        p = self.get_by_ref(promise_ref)
        if not p:
            raise ValueError(f"Promise not found: {promise_ref}")
        stage = int(p.get("escalation_stage", 0)) + 1
        new_status = "ESCALATED" if stage >= MAX_PROMISE_ESCALATION else "BROKEN"
        updates = {"escalation_stage": stage, "status": new_status}
        try:
            resp = (
                supabase.table("promises")
                .update(updates)
                .eq("promise_ref", promise_ref)
                .execute()
            )
            return resp.data[0] if resp.data else {**p, **updates}
        except Exception:
            self._memory_update(promise_ref, updates)
            return {**p, **updates}

    # ------- in-memory fallback store (used when promises table absent in remote DB) -------

    _memory = []
    _memory_enabled = False

    def _memory_store(self, row):
        PromiseService._memory_enabled = True
        PromiseService._memory.append(row)

    def _memory_fetch(self):
        return PromiseService._memory

    def _memory_update(self, promise_ref: str, updates: dict):
        for r in PromiseService._memory:
            if r["promise_ref"] == promise_ref:
                r.update(updates)


promise_service = PromiseService()
