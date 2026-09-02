import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')

from app.database import supabase

orphan_ids = ['12fc6b89-c3d5-4f32-8d23-d02be52a4943', 'b9f2e9b1-67e3-47de-95f4-8d460ce4a64b']

for oid in orphan_ids:
    print('=== ORPHAN:', oid, '===')
    
    # Customer
    ev = supabase.table('revenue_events').select('*').eq('id', oid).single().execute()
    if ev.data and ev.data.get('customer_id'):
        c = supabase.table('customers').select('*').eq('id', ev.data['customer_id']).single().execute()
        print('Customer:', c.data)
    else:
        print('Customer: None')
    
    # Webhook
    if ev.data and ev.data.get('source_webhook_id'):
        w = supabase.table('webhook_events').select('*').eq('id', ev.data['source_webhook_id']).single().execute()
        print('Webhook:', w.data)
    else:
        print('Webhook: None (source_webhook_id is null)')
    
    # Diagnoses
    d = supabase.table('diagnoses').select('*').eq('revenue_event_id', oid).execute()
    print('Diagnoses:', len(d.data))
    
    # Decisions
    dec = supabase.table('decisions').select('*').eq('revenue_event_id', oid).execute()
    print('Decisions:', len(dec.data))
    for drow in dec.data:
        print('  Decision:', drow)
    
    # Actions
    if dec.data:
        for drow in dec.data:
            a = supabase.table('actions').select('*').eq('decision_id', drow['id']).execute()
            print('Actions for decision', drow['id'], ':', len(a.data))
            for arow in a.data:
                print('  Action:', arow)
    
    # Recovery results
    if dec.data:
        for drow in dec.data:
            a = supabase.table('actions').select('id').eq('decision_id', drow['id']).execute()
            for arow in a.data:
                rr = supabase.table('recovery_results').select('*').eq('action_id', arow['id']).execute()
                print('Recovery results for action', arow['id'], ':', len(rr.data))
                for rrrow in rr.data:
                    print('  Recovery result:', rrrow)
    
    # Audit logs
    al = supabase.table('audit_logs').select('*').eq('revenue_event_id', oid).execute()
    print('Audit logs:', len(al.data))
    for alrow in al.data:
        print('  Audit:', alrow)
    
    print()