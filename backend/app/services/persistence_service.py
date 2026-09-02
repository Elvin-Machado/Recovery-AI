from datetime import datetime, timezone

from app.database import supabase


class PersistenceService:
    """
    Responsible for storing the recovery lifecycle in Supabase.

    The recovery agent decides WHAT should happen.
    This service decides HOW that information is persisted.
    """

    def _insert(self, table: str, data: dict) -> dict:
        response = supabase.table(table).insert(data).execute()

        if not response.data:
            raise RuntimeError(
                f"Insert failed for table '{table}'"
            )

        return response.data[0]

    # ---------------------------------------------------------
    # WEBHOOK
    # ---------------------------------------------------------

    def create_webhook_event(
        self,
        event_id: str,
        event_type: str,
        payload: dict,
    ) -> dict:

        # Check whether this webhook already exists
        existing = (
            supabase
            .table("webhook_events")
            .select("*")
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            return existing.data[0]

        return self._insert(
            "webhook_events",
            {
                "event_id": event_id,
                "event_type": event_type,
                "payload": payload,
            },
        )

    # ---------------------------------------------------------
    # CUSTOMER
    # ---------------------------------------------------------

    def create_customer(
        self,
        name: str,
        email: str | None = None,
        phone: str | None = None,
    ) -> dict:

        return self._insert(
            "customers",
            {
                "name": name,
                "email": email,
                "phone": phone,
            },
        )

    def get_customer_by_email(
        self,
        email: str,
    ) -> dict | None:

        response = (
            supabase
            .table("customers")
            .select("*")
            .eq("email", email)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    def get_or_create_customer(
        self,
        name: str,
        email: str | None = None,
        phone: str | None = None,
    ) -> dict:

        if email:
            existing = self.get_customer_by_email(email)
            if existing:
                return existing

        return self.create_customer(
            name=name,
            email=email,
            phone=phone,
        )

    # ---------------------------------------------------------
    # REVENUE EVENT
    # ---------------------------------------------------------

    def create_revenue_event(
        self,
        customer_id: str | None,
        webhook_id: str | None,
        event_type: str,
        amount: float,
        risk_category: str | None = None,
        failure_code: str | None = None,
        mandate_status: str | None = None,
        attempt_count: int = 0,
        days_overdue: int | None = None,
        metadata: dict | None = None,
    ) -> dict:

        return self._insert(
            "revenue_events",
            {
                "customer_id": customer_id,
                "source_webhook_id": webhook_id,
                "event_type": event_type,
                "amount": amount,
                "risk_category": risk_category,
                "status": "detected",
                "failure_code": failure_code,
                "mandate_status": mandate_status,
                "attempt_count": attempt_count,
                "days_overdue": days_overdue,
                "metadata": metadata or {},
            },
        )

    # ---------------------------------------------------------
    # DIAGNOSIS
    # ---------------------------------------------------------

    def create_diagnosis(
        self,
        revenue_event_id: str,
        category: str,
        confidence: float | None,
        reason: str | None,
        model_version: str = "recovery-model-v1",
    ) -> dict:

        return self._insert(
            "diagnoses",
            {
                "revenue_event_id": revenue_event_id,
                "category": category,
                "confidence": confidence,
                "reason": reason,
                "model_version": model_version,
            },
        )

    # ---------------------------------------------------------
    # DECISION
    # ---------------------------------------------------------

    def create_decision(
        self,
        revenue_event_id: str,
        diagnosis_id: str,
        recommended_action: str,
        confidence: float | None,
        reason: str | None,
        status: str,
    ) -> dict:

        return self._insert(
            "decisions",
            {
                "revenue_event_id": revenue_event_id,
                "diagnosis_id": diagnosis_id,
                "recommended_action": recommended_action,
                "confidence": confidence,
                "reason": reason,
                "status": status,
            },
        )

    # ---------------------------------------------------------
    # ACTION
    # ---------------------------------------------------------

    def create_action(
        self,
        decision_id: str,
        action_type: str,
        status: str,
        metadata: dict | None = None,
    ) -> dict:

        executed_at = None

        if status in {"success", "failed"}:
            executed_at = datetime.now(timezone.utc).isoformat()

        return self._insert(
            "actions",
            {
                "decision_id": decision_id,
                "action_type": action_type,
                "status": status,
                "executed_at": executed_at,
                "metadata": metadata or {},
            },
        )

    # ---------------------------------------------------------
    # RECOVERY RESULT
    # ---------------------------------------------------------

    def create_recovery_result(
        self,
        action_id: str,
        success: bool,
        recovered_amount: float,
        result_code: str | None = None,
    ) -> dict:

        return self._insert(
            "recovery_results",
            {
                "action_id": action_id,
                "success": success,
                "recovered_amount": recovered_amount,
                "result_code": result_code,
            },
        )

    # ---------------------------------------------------------
    # AUDIT LOG
    # ---------------------------------------------------------

    def create_audit_log(
        self,
        revenue_event_id: str | None,
        action: str,
        actor_type: str,
        details: dict | None = None,
    ) -> dict:

        return self._insert(
            "audit_logs",
            {
                "revenue_event_id": revenue_event_id,
                "action": action,
                "actor_type": actor_type,
                "details": details or {},
            },
        )

    # ---------------------------------------------------------
    # UPDATE REVENUE EVENT STATUS
    # ---------------------------------------------------------

    def update_revenue_event_status(
        self,
        revenue_event_id: str,
        status: str,
    ) -> dict:

        response = (
            supabase
            .table("revenue_events")
            .update({"status": status})
            .eq("id", revenue_event_id)
            .execute()
        )

        if not response.data:
            raise RuntimeError(
                f"Failed to update revenue event status: "
                f"{revenue_event_id}"
            )

        return response.data[0]

    # ---------------------------------------------------------
    # FIND REVENUE EVENT BY ID
    # ---------------------------------------------------------

    def get_revenue_event_by_id(
        self,
        revenue_event_id: str,
    ) -> dict | None:

        import uuid
        try:
            uuid.UUID(revenue_event_id)
        except ValueError:
            # Not a valid UUID, so it can't be in the revenue_events table ID column
            return None

        response = (
            supabase
            .table("revenue_events")
            .select("*")
            .eq("id", revenue_event_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # FIND REVENUE EVENT BY WEBHOOK
    # ---------------------------------------------------------

    def get_revenue_event_by_webhook_id(
        self,
        webhook_id: str,
    ) -> dict | None:

        response = (
            supabase
            .table("revenue_events")
            .select("*")
            .eq("source_webhook_id", webhook_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # FIND DIAGNOSIS
    # ---------------------------------------------------------

    def get_diagnosis_by_revenue_event_id(
        self,
        revenue_event_id: str,
    ) -> dict | None:

        response = (
            supabase
            .table("diagnoses")
            .select("*")
            .eq("revenue_event_id", revenue_event_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # FIND DECISION
    # ---------------------------------------------------------

    def get_decision_by_revenue_event_id(
        self,
        revenue_event_id: str,
    ) -> dict | None:

        response = (
            supabase
            .table("decisions")
            .select("*")
            .eq("revenue_event_id", revenue_event_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # FIND ACTION
    # ---------------------------------------------------------

    def get_action_by_decision_id(
        self,
        decision_id: str,
    ) -> dict | None:

        response = (
            supabase
            .table("actions")
            .select("*")
            .eq("decision_id", decision_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # FIND RECOVERY RESULT
    # ---------------------------------------------------------

    def get_recovery_result_by_action_id(
        self,
        action_id: str,
    ) -> dict | None:

        response = (
            supabase
            .table("recovery_results")
            .select("*")
            .eq("action_id", action_id)
            .limit(1)
            .execute()
        )

        if response.data:
            return response.data[0]

        return None

    # ---------------------------------------------------------
    # VERIFY ORPHAN CANDIDATE (Milestone 9)
    # ---------------------------------------------------------

    def verify_orphan_candidate(self, revenue_event_id: str) -> dict:
        """
        Read-only verification of a single revenue_event candidate for orphan cleanup.
        Returns a detailed report of all relationships and lifecycle records.
        """

        # 1. Get the revenue event
        rev_event = self.get_revenue_event_by_id(revenue_event_id)
        if not rev_event:
            return {
                "revenue_event_id": revenue_event_id,
                "exists": False,
                "error": "Revenue event not found",
            }

        # 2. Customer relationship
        customer = None
        if rev_event.get("customer_id"):
            customer = supabase.table("customers").select("*").eq("id", rev_event["customer_id"]).single().execute()
            customer = customer.data if customer.data else None

        # 3. Webhook association
        webhook = None
        if rev_event.get("source_webhook_id"):
            webhook = supabase.table("webhook_events").select("*").eq("id", rev_event["source_webhook_id"]).single().execute()
            webhook = webhook.data if webhook.data else None

        # 4. Diagnosis count
        diagnoses = supabase.table("diagnoses").select("*").eq("revenue_event_id", revenue_event_id).execute()
        diagnosis_count = len(diagnoses.data or [])

        # 5. Decision count
        decisions = supabase.table("decisions").select("*").eq("revenue_event_id", revenue_event_id).execute()
        decision_count = len(decisions.data or [])

        # 6. Action count
        action_count = 0
        if decisions.data:
            for dec in decisions.data:
                acts = supabase.table("actions").select("*").eq("decision_id", dec["id"]).execute()
                action_count += len(acts.data or [])

        # 7. Recovery result count
        recovery_result_count = 0
        has_successful_recovery = False
        if decisions.data:
            for dec in decisions.data:
                acts = supabase.table("actions").select("id").eq("decision_id", dec["id"]).execute()
                for act in acts.data or []:
                    rrs = supabase.table("recovery_results").select("*").eq("action_id", act["id"]).execute()
                    recovery_result_count += len(rrs.data or [])
                    for rr in rrs.data or []:
                        if rr.get("success") and float(rr.get("recovered_amount", 0)) > 0:
                            has_successful_recovery = True

        # 8. Audit log count
        audit_logs = supabase.table("audit_logs").select("*").eq("revenue_event_id", revenue_event_id).execute()
        audit_log_count = len(audit_logs.data or [])

        # 9. Check if any other table references this revenue_event
        # (We already checked diagnoses, decisions, actions, recovery_results, audit_logs)

        return {
            "revenue_event_id": revenue_event_id,
            "exists": True,
            "revenue_event": {
                "id": rev_event.get("id"),
                "customer_id": rev_event.get("customer_id"),
                "source_webhook_id": rev_event.get("source_webhook_id"),
                "event_type": rev_event.get("event_type"),
                "amount": float(rev_event.get("amount", 0)),
                "status": rev_event.get("status"),
                "failure_code": rev_event.get("failure_code"),
                "mandate_status": rev_event.get("mandate_status"),
                "attempt_count": rev_event.get("attempt_count"),
                "days_overdue": rev_event.get("days_overdue"),
                "metadata": rev_event.get("metadata"),
                "created_at": rev_event.get("created_at"),
            },
            "customer": customer,
            "webhook": webhook,
            "counts": {
                "diagnoses": diagnosis_count,
                "decisions": decision_count,
                "actions": action_count,
                "recovery_results": recovery_result_count,
                "audit_logs": audit_log_count,
            },
            "has_successful_recovery": has_successful_recovery,
            "is_safe_to_delete": (
                diagnosis_count == 0
                and decision_count == 0
                and action_count == 0
                and recovery_result_count == 0
                and not has_successful_recovery
            ),
        }

    # ---------------------------------------------------------
    # REPAIR LEGACY STATUS (Milestone 9)
    # ---------------------------------------------------------

    def repair_legacy_status(self, revenue_event_id: str) -> dict:
        """
        Repair a revenue event that has successful recovery results
        but still has status='detected'. Updates status to 'recovered'
        and creates an audit log explaining the repair.
        """

        rev_event = self.get_revenue_event_by_id(revenue_event_id)
        if not rev_event:
            return {
                "revenue_event_id": revenue_event_id,
                "success": False,
                "error": "Revenue event not found",
            }

        # Verify it has successful recovery results
        has_successful_recovery = False
        recovered_amount = 0.0

        decisions = supabase.table("decisions").select("id").eq("revenue_event_id", revenue_event_id).execute()
        if decisions.data:
            for dec in decisions.data:
                acts = supabase.table("actions").select("id").eq("decision_id", dec["id"]).execute()
                for act in acts.data or []:
                    rrs = supabase.table("recovery_results").select("*").eq("action_id", act["id"]).execute()
                    for rr in rrs.data or []:
                        if rr.get("success") and float(rr.get("recovered_amount", 0)) > 0:
                            has_successful_recovery = True
                            recovered_amount = float(rr.get("recovered_amount", 0))

        if not has_successful_recovery:
            return {
                "revenue_event_id": revenue_event_id,
                "success": False,
                "error": "No successful recovery result found",
                "current_status": rev_event.get("status"),
            }

        # Verify amount matches
        event_amount = float(rev_event.get("amount", 0))
        if abs(event_amount - recovered_amount) > 0.01:
            return {
                "revenue_event_id": revenue_event_id,
                "success": False,
                "error": f"Amount mismatch: event={event_amount}, recovery={recovered_amount}",
                "current_status": rev_event.get("status"),
            }

        # Update status to recovered
        updated_event = self.update_revenue_event_status(
            revenue_event_id=revenue_event_id,
            status="recovered",
        )

        # Create audit log explaining the legacy repair
        self.create_audit_log(
            revenue_event_id=revenue_event_id,
            action="legacy_status_repair",
            actor_type="system_maintenance",
            details={
                "previous_status": rev_event.get("status"),
                "new_status": "recovered",
                "reason": "Legacy status repair: revenue event had successful recovery result but status was not updated",
                "recovered_amount": recovered_amount,
            },
        )

        return {
            "revenue_event_id": revenue_event_id,
            "success": True,
            "previous_status": rev_event.get("status"),
            "new_status": "recovered",
            "recovered_amount": recovered_amount,
            "updated_event": updated_event,
        }

    # ---------------------------------------------------------
    # CLEANUP ORPHANS (Milestone 9)
    # ---------------------------------------------------------

    def cleanup_orphans(self, revenue_event_ids: list[str], confirm: bool = False) -> dict:
        """
        Safely delete orphan revenue events.

        Requirements:
        - Must verify each ID against orphan classification
        - Must refuse deletion if any diagnosis, decision, action, or recovery_result exists
        - Must refuse deletion if the event has a successful recovery result
        - Must require explicit confirm=True parameter
        - Default confirm=False (dry run)
        """

        if not confirm:
            # Dry run - just verify
            results = []
            for rid in revenue_event_ids:
                verification = self.verify_orphan_candidate(rid)
                results.append({
                    "revenue_event_id": rid,
                    "would_delete": verification.get("is_safe_to_delete", False),
                    "verification": verification,
                })
            return {
                "dry_run": True,
                "confirm": False,
                "message": "Dry run complete. Set confirm=True to execute deletion.",
                "results": results,
            }

        # Actual deletion
        results = []
        deleted = []
        refused = []

        for rid in revenue_event_ids:
            verification = self.verify_orphan_candidate(rid)

            if not verification.get("exists", False):
                refused.append({
                    "revenue_event_id": rid,
                    "reason": "Revenue event not found",
                })
                continue

            if not verification.get("is_safe_to_delete", False):
                refused.append({
                    "revenue_event_id": rid,
                    "reason": "Not safe to delete - has lifecycle records or successful recovery",
                    "verification": verification,
                })
                continue

            # Delete the revenue event
            try:
                supabase.table("revenue_events").delete().eq("id", rid).execute()
                deleted.append(rid)
                results.append({
                    "revenue_event_id": rid,
                    "deleted": True,
                })
            except Exception as e:
                refused.append({
                    "revenue_event_id": rid,
                    "reason": f"Deletion failed: {str(e)}",
                })

        return {
            "dry_run": False,
            "confirm": True,
            "deleted": deleted,
            "refused": refused,
            "results": results,
        }


# ---------------------------------------------------------
# SINGLE SERVICE INSTANCE
# ---------------------------------------------------------

persistence_service = PersistenceService()