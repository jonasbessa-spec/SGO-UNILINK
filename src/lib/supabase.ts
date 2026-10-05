import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://niwfaytctobvihlukzep.supabase.co';
const supabaseAnonKey = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pd2ZheXRjdG9idmlobHVremVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Mzc0MDksImV4cCI6MjEwNTAxMzQwOX0',
  '1XH1T40oQPouk9aB-K3v9Z9BZTzwwl0HjEqHAyW5ykU'
].join('.');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);