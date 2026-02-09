import { useEffect } from 'react';
import { useRouter } from 'next/router.js';
import { supabase } from '../lib/supabase/client';

/**
 * Hook to protect routes that require authentication.
 * Redirects to /findr/auth if user is not logged in.
 * 
 * @example
 * function ProtectedPage() {
 *   const { user, loading } = useRequireAuth();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   
 *   return <div>Protected content for {user.email}</div>;
 * }
 */
export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Save the current path to redirect back after login
        const returnPath = router.asPath;
        router.push(`/findr/auth?returnTo=${encodeURIComponent(returnPath)}`);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/findr/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return {};
}
