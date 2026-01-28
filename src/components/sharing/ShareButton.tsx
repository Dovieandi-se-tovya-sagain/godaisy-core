"use client";

import { useState } from 'react';
import { ShareModal } from './ShareModal';

interface ShareButtonProps {
  activityId: string; // kept in the public type for compatibility, not used here
  activityName: string;
  className?: string;
}

export function ShareButton({
  activityName,
  className = ''
}: ShareButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors ${className}`}
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
        Share
      </button>
      
      <ShareModal
        isOpen={isModalOpen}
        activityName={activityName}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
