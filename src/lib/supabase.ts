import { createClient } from '@supabase/supabase-js';

function cleanEnvValue(value: string | undefined): string | undefined {
  let cleaned = value?.trim();

  while (cleaned && cleaned.length >= 2) {
    const firstCharacter = cleaned[0];
    const lastCharacter = cleaned[cleaned.length - 1];

    if ((firstCharacter !== '"' && firstCharacter !== "'") || firstCharacter !== lastCharacter) break;
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned || undefined;
}

const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL)
  || 'https://niwfaytctobvihlukzep.supabase.co';
const supabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY)
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pd2ZheXRjdG9idmlobHVremVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Mzc0MDksImV4cCI6MjEwNTAxMzQwOX0.1XH1T40oQPouk9aB-K3v9Z9BZTzwwl0HjEqHAyW5ykU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
