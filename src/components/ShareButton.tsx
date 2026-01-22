// /components/ShareButton.tsx
import React, { useState } from 'react';
import { shareToWhatsApp, SharePayload } from '../utils/share';

type ShareButtonProps = {
  payload: SharePayload;
  className?: string;
  children?: React.ReactNode;
  onShared?: (status: string) => void;
};

export const ShareButton: React.FC<ShareButtonProps> = ({ payload, className, children, onShared }) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    const result = await shareToWhatsApp(payload);
    setBusy(false);
    setStatus(result);
    onShared?.(result);
    // Auto-clear status after a moment
    window.setTimeout(() => setStatus(null), 2500);
  };

  return (
    <div className={`share-to-whatsapp ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className="share-btn"
      >
        {busy ? 'Sharing…' : (children || 'Share via WhatsApp')}
      </button>
      {status && <div className="share-status" role="status">{status}</div>}
      <style jsx>{`
        .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border: none;
          padding: 0.6rem 1rem;
          border-radius: 999px;
          cursor: pointer;
          background: #25D366; /* WhatsApp green */
          color: #fff;
          font-weight: 600;
        }
        .share-btn[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .share-status {
          margin-top: 0.4rem;
          font-size: 0.9rem;
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};