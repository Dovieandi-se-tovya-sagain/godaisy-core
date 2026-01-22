import { useState } from 'react';

interface UseSharingReturn {
  openShareModal: (activityId: string, activityName: string) => void;
  closeShareModal: () => void;
  isShareModalOpen: boolean;
  shareModalData: {
    activityId: string;
    activityName: string;
  } | null;
}

export const useSharing = (): UseSharingReturn => {
  const [shareModalData, setShareModalData] = useState<{
    activityId: string;
    activityName: string;
  } | null>(null);

  const openShareModal = (activityId: string, activityName: string) => {
    setShareModalData({
      activityId,
      activityName,
    });
  };

  const closeShareModal = () => {
    setShareModalData(null);
  };

  return {
    openShareModal,
    closeShareModal,
    isShareModalOpen: !!shareModalData,
    shareModalData,
  };
};
