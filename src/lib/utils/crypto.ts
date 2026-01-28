// Cryptographic utilities for signing and verifying share tokens
import { createHmac } from 'crypto';

const SECRET_KEY = process.env.SHARE_TOKEN_SECRET || 'dev-secret-key-change-in-production';

export async function signData(data: string): Promise<string> {
  const hmac = createHmac('sha256', SECRET_KEY);
  hmac.update(data);
  return hmac.digest('hex');
}

export async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await signData(data);
  return expectedSignature === signature;
}
