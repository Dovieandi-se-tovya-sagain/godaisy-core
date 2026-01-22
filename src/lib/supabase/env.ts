const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!rawUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}

if (!rawAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
}

const normalizedUrl = rawUrl.replace(/\/$/, '');

export const SUPABASE_URL = normalizedUrl;
export const SUPABASE_ANON_KEY = rawAnonKey;
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
export const PRIMARY_EDGE_FUNCTION = 'make-server-19ec785b';
export const EDGE_FUNCTION_BASE = `${SUPABASE_FUNCTIONS_URL}/${PRIMARY_EDGE_FUNCTION}`;

export function buildEdgeFunctionUrl(path: string): string {
  const trimmedPath = path.replace(/^\//, '');
  return `${EDGE_FUNCTION_BASE}/${trimmedPath}`;
}
