import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')
from app.database import supabase

# Verify orphans are deleted
for eid in ['12fc6b89-c3d5-4f32-8d23-d02be52a4943', 'b9f2e9b1-67e3-47de-95f4-8d460ce4a64b']:
    ev = supabase.table('revenue_events').select('id').eq('id', eid).execute()
    if ev.data:
        print(f"ORPHAN STILL EXISTS: {eid}")
    else:
        print(f"ORPHAN DELETED: {eid}")

# Verify legacy events are recovered
for eid in ['7cbb137b-7d2b-41d2-a24d-99148b58079e', '13d8d2f7-7b88-401d-a66b-2e9b73e01f02']:
    ev = supabase.table('revenue_events').select('id,status,amount').eq('id', eid).single().execute()
    if ev.data:
        print(f"LEGACY: {ev.data['id']} status={ev.data['status']} amount={ev.data['amount']}")

# Total counts
rev = supabase.table('revenue_events').select('status,amount').execute()
from collections import Counter
counts = Counter(ev['status'] for ev in rev.data)
print("\nStatus counts:")
for s, c in sorted(counts.items()):
    print(f"  {s}: {c}")

total_rev = sum(float(ev['amount']) for ev in rev.data)
risk_statuses = {"detected", "failed", "blocked", "pending_customer_action"}
revenue_at_risk = sum(float(ev['amount']) for ev in rev.data if ev['status'] in risk_statuses)
recovered = sum(float(ev['amount']) for ev in rev.data if ev['status'] == "recovered")
print(f"\nTotal revenue: {total_rev}")
print(f"Revenue at risk: {revenue_at_risk}")
print(f"Recovered: {recovered}")
print(f"Total revenue_events: {len(rev.data)}")

# Verify no other records were affected - check customers for the deleted orphans
print("\nCustomer check for deleted orphans:")
for cid in ['86a4e666-765d-407a-8440-772d9a48cf57', 'd62cdb05-a053-4ce5-8c0e-0c8228adcd82']:
    c = supabase.table('customers').select('id,name,email').eq('id', cid).single().execute()
    if c.data:
        print(f"  Customer {c.data['id']} ({c.data['name']}) still exists - OK")

# Check that no diagnoses/decisions/actions/recovery_results were created for deleted orphans
print("\nVerification that no lifecycle records exist for deleted orphans:")
for eid in ['12fc6b89-c3d5-4f32-8d23-d02be52a4943', 'b9f2e9b1-67e3-47de-95f4-8d460ce4a64b']:
    diag = supabase.table('diagnoses').select('id').eq('revenue_event_id', eid).execute()
    dec = supabase.table('decisions').select('id').eq('revenue_event_id', eid).execute()
    print(f"  {eid}: diagnoses={len(diag.data)}, decisions={len(dec.data)}")