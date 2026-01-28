/**
 * Performance logging utility for Supabase queries
 * Wraps queries with timing and logs slow queries
 */

export async function queryWithTiming<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development' || process.env.LOG_QUERY_TIMING === 'true') {
      console.log(`[Supabase] ${queryName}: ${duration.toFixed(2)}ms`);
    }
    
    // Always warn on slow queries
    if (duration > 500) {
      console.warn(`[Supabase] Slow query: ${queryName} (${duration.toFixed(2)}ms)`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Supabase] Query failed: ${queryName} (${duration.toFixed(2)}ms)`, error);
    throw error;
  }
}

/**
 * Timing decorator for multiple parallel queries
 */
export async function timedParallelQueries<T extends readonly unknown[]>(
  queries: { [K in keyof T]: { fn: () => Promise<T[K]>; name: string } }
): Promise<T> {
  const start = performance.now();
  
  console.log(`[Supabase] Starting ${queries.length} parallel queries:`, 
    queries.map(q => q.name).join(', ')
  );
  
  try {
    const results = await Promise.all(
      queries.map(({ fn, name }) => queryWithTiming(fn, name))
    );
    
    const totalDuration = performance.now() - start;
    console.log(`[Supabase] Parallel queries completed in ${totalDuration.toFixed(2)}ms`);
    
    return results as unknown as T;
  } catch (error) {
    const totalDuration = performance.now() - start;
    console.error(`[Supabase] Parallel queries failed after ${totalDuration.toFixed(2)}ms`, error);
    throw error;
  }
}
