import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')
from app.database import supabase
for eid in ['7cbb137b-7d2b-41d2-a24d-99148b58079e', '13d8d2f7-7b88-401d-a66b-2e9b73e01f02']:
    ev = supabase.table('revenue_events').select('id,status,amount').eq('id', eid).single().execute()
    if ev.data:
        print(f"{ev.data['id']} status={ev.data['status']} amount={ev.data['amount']}")
    else:
        print(f"{eid} NOT FOUND")