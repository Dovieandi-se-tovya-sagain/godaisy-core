import { authClient } from './authClient';

/**
 * Fetch wrapper that adds an Authorization: Bearer header from the
 * current authClient session.
 *
 * Use for any API route guarded by getAuthUser(req) on the server. Cookie-based
 * auth no longer works because the auth client stores its session in
 * localStorage (key 'godaisy-auth'), not cookies.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const { data: { session } } = await authClient.auth.getSession();
  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  return fetch(url, { ...options, headers });
}
