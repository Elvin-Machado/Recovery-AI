import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')
from app.database import supabase
for eid in ['7cbb137b-7d2b-41d2-a24d-99148b58079e', '13d8d2f7-7b88-401d-a66b-2e9b73e01f02']:
    print(f"=== {eid} ===")
    # Check decisions
    dec = supabase.table('decisions').select('id').eq('revenue_event_id', eid).execute()
    if dec.data:
        for d in dec.data:
            act = supabase.table('actions').select('id,status').eq('decision_id', d['id']).execute()
            for a in act.data:
                rr = supabase.table('recovery_results').select('success,recovered_amount').eq('action_id', a['id']).execute()
                for r in rr.data:
                    print(f"  recovery_result: success={r['success']}, amount={r['recovered_amount']}")
    # Check audit logs
    al = supabase.table('audit_logs').select('action,details').eq('revenue_event_id', eid).execute()
    for a in al.data:
        print(f"  audit: {a['action']}")