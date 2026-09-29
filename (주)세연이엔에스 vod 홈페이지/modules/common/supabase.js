const SUPABASE_URL = 'https://ymzbfkinxxutwmghjppg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemJma2lueHh1dHdtZ2hqcHBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MzY0MDgsImV4cCI6MjEwNTExMjQwOH0.6t41urWoIu5ORhSrrCQaxYskbhlk_rabNvoI0Gu_7k4';

const { createClient } = supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);