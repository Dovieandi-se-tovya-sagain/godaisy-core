/**
 * Stripe Client-Side Loader
 *
 * Browser-only Stripe loader using publishable key.
 * Implements singleton pattern to avoid multiple Stripe.js loads.
 *
 * @module lib/stripe/client
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

/**
 * Get or create the Stripe.js client instance.
 *
 * Uses singleton pattern to ensure Stripe.js is only loaded once
 * per page session, improving performance and avoiding duplicate loads.
 *
 * @returns Promise resolving to Stripe instance or null if key is invalid
 * @throws Error if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set
 *
 * @example
 * ```typescript
 * const stripe = await getStripe();
 * if (stripe) {
 *   // Use stripe client
 * }
 * ```
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!key) {
      throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined in environment variables');
    }

    stripePromise = loadStripe(key);
  }

  return stripePromise;
};
