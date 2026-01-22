/**
 * Founder Status Hook
 *
 * Checks if the current user is one of the first 500 users (Founder badge).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

interface FounderStatusResponse {
  isFounder: boolean;
  userRank: number | null;
}

export function useFounderStatus() {
  return useQuery({
    queryKey: ['founder-status'],
    queryFn: async (): Promise<FounderStatusResponse> => {
      // Get authenticated user and access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return { isFounder: false, userRank: null };
      }

      // Fetch founder status from API
      const res = await fetch('/api/findr/founder-status', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        console.warn('[useFounderStatus] Failed to fetch founder status');
        return { isFounder: false, userRank: null };
      }

      const data = await res.json();
      return {
        isFounder: data.isFounder || false,
        userRank: data.userRank || null,
      };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - founder status doesn't change
    enabled: true,
  });
}
