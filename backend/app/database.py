from supabase import Client, create_client

from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)