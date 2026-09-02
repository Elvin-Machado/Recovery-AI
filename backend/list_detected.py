import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')
from app.database import supabase
rev = supabase.table('revenue_events').select('id, amount, status, failure_code').eq('status', 'detected').execute()
for ev in rev.data:
    print(f"id={ev['id']} amount={ev['amount']} failure={ev.get('failure_code')}")