import { cookies } from 'next/headers.js';
import { createServerClient } from '@supabase/ssr';

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!\n\n' +
      'Check your Supabase project\'s API settings to find these values:\n' +
      'https://supabase.com/dashboard/project/_/settings/api\n\n' +
      'Add these environment variables to your Vercel project:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Ignored when called from a Server Component
          }
        },
      },
    }
  );
}