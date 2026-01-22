/**
 * User Status Hook
 *
 * Fetches user status data and calculates medals based on activity and tenure.
 */

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFounderStatus } from '@/hooks/useFounderStatus';
import { getUserMedals, type UserData, type StatusMedal } from '@/lib/findr/statusMedals';
import type { CatchSession } from '@/lib/findr/badgeDefinitions';

interface UseUserStatusResult {
  medals: {
    gold?: StatusMedal;
    silver?: StatusMedal;
    bronze?: StatusMedal;
  };
  isLoading: boolean;
}

export function useUserStatus(sessions: CatchSession[]): UseUserStatusResult {
  const { user } = useAuth();
  const { data: founderData, isLoading: founderLoading } = useFounderStatus();

  const medals = useMemo(() => {
    if (!user) {
      return {};
    }

    // Build user data from available information
    const userData: UserData = {
      // Use founder rank as userId (1-indexed)
      userId: founderData?.userRank || 9999,
      // Use user creation date
      joinDate: user.created_at ? new Date(user.created_at) : new Date(),
      // Map sessions to required format
      sessions: sessions.map(s => ({
        date: s.caught_at,
        type: 'catch'
      }))
    };

    return getUserMedals(userData);
  }, [user, founderData, sessions]);

  return {
    medals,
    isLoading: founderLoading
  };
}
