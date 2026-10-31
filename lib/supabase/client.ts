import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('seu-projeto')) {
    // Retorna cliente mock / fallback resiliente durante desenvolvimento inicial
    return null;
  }

  return createBrowserClient(url, anonKey);
}
