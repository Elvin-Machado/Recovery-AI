import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')

from app.database import supabase

# Recovered event integrity
rev_response = supabase.table("revenue_events").select("id, amount, status").execute()
rev_events = rev_response.data or []

recovered_events = [ev for ev in rev_events if ev.get("status") == "recovered"]
print(f"Total recovered events: {len(recovered_events)}")

missing_rr = 0
unsuccessful_rr = 0
amount_mismatch = 0

for ev in recovered_events:
    dec = supabase.table("decisions").select("id").eq("revenue_event_id", ev["id"]).execute()
    has_success_rr = False
    if dec.data:
        for d in dec.data:
            act = supabase.table("actions").select("id, status").eq("decision_id", d["id"]).execute()
            for a in act.data:
                rr = supabase.table("recovery_results").select("success, recovered_amount").eq("action_id", a["id"]).execute()
                for r in rr.data:
                    if r.get("success") and float(r.get("recovered_amount", 0)) > 0:
                        has_success_rr = True
                        if abs(float(ev.get("amount", 0)) - float(r.get("recovered_amount", 0))) > 0.01:
                            amount_mismatch += 1
                            print(f"  AMOUNT MISMATCH: event {ev['id']} amount={ev['amount']}, rr amount={r['recovered_amount']}")
    if not has_success_rr:
        missing_rr += 1
        print(f"  MISSING SUCCESS RR: event {ev['id']}")

print(f"Recovered events missing successful recovery_result: {missing_rr}")
print(f"Recovered events with unsuccessful recovery_result: {unsuccessful_rr}")
print(f"Recovered amount mismatches: {amount_mismatch}")

# Unresolved event integrity
unresolved_statuses = {"detected", "failed", "blocked", "pending_customer_action"}
unresolved_events = [ev for ev in rev_events if ev.get("status") in unresolved_statuses]
print(f"\nTotal unresolved events: {len(unresolved_events)}")

unresolved_with_rr = 0
for ev in unresolved_events:
    dec = supabase.table("decisions").select("id").eq("revenue_event_id", ev["id"]).execute()
    if dec.data:
        for d in dec.data:
            act = supabase.table("actions").select("id").eq("decision_id", d["id"]).execute()
            for a in act.data:
                rr = supabase.table("recovery_results").select("success, recovered_amount").eq("action_id", a["id"]).execute()
                for r in rr.data:
                    if r.get("success") and float(r.get("recovered_amount", 0)) > 0:
                        unresolved_with_rr += 1
                        print(f"  UNRESOLVED WITH SUCCESS RR: event {ev['id']} (status={ev['status']})")

print(f"Unresolved events with successful recovery_result: {unresolved_with_rr}")

# Also check breakdown by status
print("\n=== Events by status ===")
from collections import Counter
status_counts = Counter(ev.get("status", "unknown") for ev in rev_events)
for status, count in sorted(status_counts.items()):
    print(f"  {status}: {count}")