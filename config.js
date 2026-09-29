// ============================================================
// إعدادات الاتصال بقاعدة بيانات Supabase
// ============================================================
const SUPABASE_URL = "https://nkbqwquyukgqhroksdpc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rYnF3cXV5dWtncWhyb2tzZHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTc5NDgsImV4cCI6MjEwNjE5Mzk0OH0.BRUcb56-_LJW6U9MqJeb35Hkh0OE1P-ooiwGBo23ZWY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// رقم واتساب المتجر لاستقبال الطلبات (بصيغة دولية بدون + أو أصفار، مثال: 9647701234567)
const WHATSAPP_NUMBER = "9647700000000"; // ← غيّر هذا الرقم برقمك الحقيقي
