// ID generation utilities for sharing system
import { randomBytes } from 'crypto';
import type { NextApiRequest } from 'next';

export function generateId(): string {
  return randomBytes(16).toString('hex');
}

export function generateShortId(): string {
  // Generate a short, URL-safe ID for shortlinks
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateDeviceFingerprint(req: Pick<NextApiRequest, 'headers'>): string {
  // Simple device fingerprinting based on headers
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprint = `${String(userAgent)}-${String(acceptLanguage)}-${String(acceptEncoding)}`;
  return Buffer.from(fingerprint).toString('base64').slice(0, 16);
}
