/**
 * Mutation Queue Service
 *
 * Persistent queue for offline mutations that survives app restarts.
 * Processes mutations in order when connectivity returns.
 *
 * Usage:
 * ```typescript
 * import { mutationQueue } from './mutationQueue';
 *
 * // Queue a mutation when offline
 * await mutationQueue.enqueue({
 *   type: 'CREATE_PLANT',
 *   payload: plantData,
 *   timestamp: Date.now()
 * });
 *
 * // Process queue when online
 * await mutationQueue.processQueue();
 * ```
 */

import { Preferences } from '@capacitor/preferences';

const QUEUE_KEY = 'offline_mutation_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export type MutationType =
  | 'CREATE_PLANT'
  | 'UPDATE_PLANT'
  | 'DELETE_PLANT'
  | 'LOG_WATERING'
  | 'UPDATE_HEALTH';

export interface Mutation {
  id: string;
  type: MutationType;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  lastError?: string;
  localId?: string; // For optimistic updates
}

export interface QueueState {
  mutations: Mutation[];
  isProcessing: boolean;
  lastProcessedAt: number | null;
}

type MutationHandler = (mutation: Mutation) => Promise<{ success: boolean; serverId?: string; error?: string }>;

class MutationQueueService {
  private queue: Mutation[] = [];
  private isProcessing = false;
  private handlers: Map<MutationType, MutationHandler> = new Map();
  private listeners: Set<(state: QueueState) => void> = new Set();
  private lastProcessedAt: number | null = null;

  /**
   * Initialize the queue from persistent storage
   */
  async initialize(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: QUEUE_KEY });
      if (value) {
        const data = JSON.parse(value);
        this.queue = data.mutations || [];
        this.lastProcessedAt = data.lastProcessedAt || null;
      }
      console.log('[MutationQueue] Initialized with ' + this.queue.length + ' pending mutations');
    } catch (error) {
      console.error('[MutationQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }

  /**
   * Register a handler for a mutation type
   */
  registerHandler(type: MutationType, handler: MutationHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add a mutation to the queue
   */
  async enqueue(mutation: Omit<Mutation, 'id' | 'retries'>): Promise<string> {
    const id = this.generateId();
    const newMutation: Mutation = {
      ...mutation,
      id,
      retries: 0,
    };

    this.queue.push(newMutation);
    await this.persistQueue();
    this.notifyListeners();

    console.log('[MutationQueue] Enqueued ' + mutation.type + ' (id: ' + id + ')');
    return id;
  }

  /**
   * Remove a mutation from the queue
   */
  async dequeue(id: string): Promise<void> {
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Get the current queue state
   */
  getState(): QueueState {
    return {
      mutations: [...this.queue],
      isProcessing: this.isProcessing,
      lastProcessedAt: this.lastProcessedAt,
    };
  }

  /**
   * Get pending mutation count
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Subscribe to queue state changes
   */
  subscribe(listener: (state: QueueState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * Process all queued mutations
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[MutationQueue] Already processing, skipping');
      return { processed: 0, failed: 0 };
    }

    if (this.queue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    this.notifyListeners();

    let processed = 0;
    let failed = 0;

    console.log('[MutationQueue] Processing ' + this.queue.length + ' mutations...');

    // Process in order (FIFO)
    const toProcess = [...this.queue];

    for (const mutation of toProcess) {
      try {
        const result = await this.processMutation(mutation);

        if (result.success) {
          await this.dequeue(mutation.id);
          processed++;
          console.log('[MutationQueue] Processed ' + mutation.type + ' successfully');
        } else {
          await this.handleFailure(mutation, result.error || 'Unknown error');
          failed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.handleFailure(mutation, errorMessage);
        failed++;
      }

      // Small delay between mutations to avoid rate limiting
      await this.delay(100);
    }

    this.lastProcessedAt = Date.now();
    this.isProcessing = false;
    await this.persistQueue();
    this.notifyListeners();

    console.log('[MutationQueue] Complete: ' + processed + ' processed, ' + failed + ' failed');
    return { processed, failed };
  }

  /**
   * Process a single mutation
   */
  private async processMutation(mutation: Mutation): Promise<{ success: boolean; serverId?: string; error?: string }> {
    const handler = this.handlers.get(mutation.type);

    if (!handler) {
      console.error('[MutationQueue] No handler for ' + mutation.type);
      return { success: false, error: 'No handler registered for ' + mutation.type };
    }

    return handler(mutation);
  }

  /**
   * Handle a failed mutation with exponential backoff
   */
  private async handleFailure(mutation: Mutation, error: string): Promise<void> {
    mutation.retries++;
    mutation.lastError = error;

    if (mutation.retries >= MAX_RETRIES) {
      console.error('[MutationQueue] ' + mutation.type + ' failed after ' + MAX_RETRIES + ' retries, removing from queue');
      await this.dequeue(mutation.id);
      // TODO: Store in dead letter queue for manual review
      return;
    }

    console.warn('[MutationQueue] ' + mutation.type + ' failed (attempt ' + mutation.retries + '/' + MAX_RETRIES + '): ' + error);

    // Update in place
    const index = this.queue.findIndex((m) => m.id === mutation.id);
    if (index !== -1) {
      this.queue[index] = mutation;
    }

    await this.persistQueue();
  }

  /**
   * Clear all queued mutations (use with caution)
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
    this.notifyListeners();
    console.log('[MutationQueue] Queue cleared');
  }

  /**
   * Get mutations by type
   */
  getMutationsByType(type: MutationType): Mutation[] {
    return this.queue.filter((m) => m.type === type);
  }

  /**
   * Check if a specific entity has pending mutations
   */
  hasPendingMutations(localId: string): boolean {
    return this.queue.some((m) => m.localId === localId);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async persistQueue(): Promise<void> {
    try {
      await Preferences.set({
        key: QUEUE_KEY,
        value: JSON.stringify({
          mutations: this.queue,
          lastProcessedAt: this.lastProcessedAt,
        }),
      });
    } catch (error) {
      console.error('[MutationQueue] Failed to persist queue:', error);
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  getBackoffDelay(retries: number): number {
    return Math.min(BASE_DELAY_MS * Math.pow(2, retries), 60000);
  }
}

// Singleton instance
export const mutationQueue = new MutationQueueService();
