from supabase import Client, create_client
from postgrest import SyncPostgrestClient
from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY

try:
    supabase: Client = create_client(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY
    )
except Exception:
    try:
        headers = {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}"
        }
        supabase = SyncPostgrestClient(f"{SUPABASE_URL}/rest/v1", headers=headers)
        supabase.postgrest = supabase
    except Exception:
        class DummyClient:
            def __getattr__(self, name):
                return lambda *args, **kwargs: self
            def execute(self):
                raise RuntimeError("Database connection not configured")
        supabase = DummyClient()