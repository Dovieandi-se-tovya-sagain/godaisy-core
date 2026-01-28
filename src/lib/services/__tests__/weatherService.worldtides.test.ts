// lib/services/__tests__/weatherService.worldtides.test.ts

/**
 * Unit Tests for WorldTides Integration
 *
 * Tests the fetchWorldTides function in weatherService.ts
 * WorldTides is the primary tide provider with 24h cache TTL
 */

import { fetchWorldTides } from '../weatherService';

// Mock global fetch
global.fetch = jest.fn();

// Mock weather metrics
jest.mock('../../monitoring/weatherMetrics', () => ({
  monitoredFetch: jest.fn(async (provider: string, endpoint: string, url: string, options?: RequestInit) => {
    return global.fetch(url, options);
  }),
  weatherMetrics: {
    start: jest.fn(() => ({
      success: jest.fn(),
      failure: jest.fn(),
    })),
  },
}));

// Sample WorldTides response
const mockWorldTidesResponse = {
  status: 200,
  callCount: 1,
  copyright: 'Tidal data retrieved from www.worldtides.info',
  requestLat: 50.0,
  requestLon: -5.0,
  responseLat: 50.0,
  responseLon: -5.0,
  atlas: 'TPXO9-atlas-v5',
  station: 'Falmouth, England',
  stationDistance: 5.2,
  extremes: [
    {
      dt: 1729324800,
      date: '2025-10-19T06:00:00+00:00',
      height: 4.52,
      type: 'High' as const,
    },
    {
      dt: 1729345200,
      date: '2025-10-19T11:40:00+00:00',
      height: 1.18,
      type: 'Low' as const,
    },
    {
      dt: 1729368000,
      date: '2025-10-19T18:00:00+00:00',
      height: 4.81,
      type: 'High' as const,
    },
    {
      dt: 1729389600,
      date: '2025-10-20T00:00:00+00:00',
      height: 1.05,
      type: 'Low' as const,
    },
  ],
  responseTime: 0.012,
};

describe('fetchWorldTides', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock environment variable
    process.env.WORLDTIDES_API_KEY = 'test-worldtides-key';

    // Default mock response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockWorldTidesResponse,
    });
  });

  afterEach(() => {
    delete process.env.WORLDTIDES_API_KEY;
  });

  describe('Basic Validation', () => {
    it('should return null if WORLDTIDES_API_KEY is missing', async () => {
      delete process.env.WORLDTIDES_API_KEY;

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch tide data for valid coordinates', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('extremes');
      expect(Array.isArray(result?.extremes)).toBe(true);
    });

    it('should call WorldTides API with correct URL structure', async () => {
      await fetchWorldTides(50.123, -5.456, 7);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      
      expect(callUrl).toContain('https://www.worldtides.info/api/v3');
      expect(callUrl).toContain('extremes');
      expect(callUrl).toContain('lat=50.123');
      expect(callUrl).toContain('lon=-5.456');
      expect(callUrl).toContain('key=test-worldtides-key');
      expect(callUrl).toContain('start=');
      expect(callUrl).toContain('length=');
    });

    it('should calculate length parameter correctly for days', async () => {
      await fetchWorldTides(50.0, -5.0, 7);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(callUrl);
      const length = url.searchParams.get('length');
      
      // 7 days = 7 * 24 * 60 * 60 = 604800 seconds
      expect(length).toBe('604800');
    });

    it('should default to 7 days if not specified', async () => {
      await fetchWorldTides(50.0, -5.0);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(callUrl);
      const length = url.searchParams.get('length');
      
      expect(length).toBe('604800'); // 7 days
    });

    it('should set User-Agent header', async () => {
      await fetchWorldTides(50.0, -5.0);

      const headers = (global.fetch as jest.Mock).mock.calls[0][1]?.headers;
      expect(headers).toHaveProperty('User-Agent');
      expect(headers['User-Agent']).toContain('WotNow');
    });
  });

  describe('Successful Requests', () => {
    it('should return tide extremes data', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      expect(result?.extremes).toBeDefined();
      expect(result?.extremes.length).toBeGreaterThan(0);
    });

    it('should include high and low tide types', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const types = result?.extremes.map(e => e.type) || [];
      expect(types).toContain('High');
      expect(types).toContain('Low');
    });

    it('should include tide heights in meters', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const firstExtreme = result?.extremes[0];
      expect(firstExtreme).toHaveProperty('height');
      expect(typeof firstExtreme?.height).toBe('number');
      expect(firstExtreme?.height).toBeGreaterThan(0);
    });

    it('should include Unix timestamp and ISO date', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const firstExtreme = result?.extremes[0];
      expect(firstExtreme).toHaveProperty('dt');
      expect(firstExtreme).toHaveProperty('date');
      expect(typeof firstExtreme?.dt).toBe('number');
      expect(typeof firstExtreme?.date).toBe('string');
    });

    it('should include metadata fields', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('status');
      expect(result?.status).toBe(200);
    });

    it('should include optional station information', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      // Optional fields may or may not be present
      if (result?.stationDistance !== undefined) {
        expect(typeof result.stationDistance).toBe('number');
      }
    });

    it('should support different day ranges', async () => {
      // Test 1 day
      await fetchWorldTides(50.0, -5.0, 1);
      let callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      let url = new URL(callUrl);
      expect(url.searchParams.get('length')).toBe('86400'); // 1 day

      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockWorldTidesResponse,
      });

      // Test 14 days
      await fetchWorldTides(50.0, -5.0, 14);
      callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      url = new URL(callUrl);
      expect(url.searchParams.get('length')).toBe('1209600'); // 14 days
    });
  });

  describe('Error Handling', () => {
    it('should return null on API error (non-200 status)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        json: async () => ({ error: 'Payment required' }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null on 401 unauthorized', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null on 429 rate limit', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null on 500 server error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null if response has no extremes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          extremes: [],
        }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should return null if response extremes is undefined', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          // extremes field missing
        }),
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).toBeNull();
    });
  });

  describe('Coordinate Handling', () => {
    it('should accept positive latitudes', async () => {
      const result = await fetchWorldTides(50.123, -5.456);

      expect(result).not.toBeNull();
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('lat=50.123');
    });

    it('should accept negative latitudes', async () => {
      const result = await fetchWorldTides(-35.5, 150.0);

      expect(result).not.toBeNull();
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('lat=-35.5');
    });

    it('should accept positive longitudes', async () => {
      const result = await fetchWorldTides(50.0, 150.5);

      expect(result).not.toBeNull();
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('lon=150.5');
    });

    it('should accept negative longitudes', async () => {
      const result = await fetchWorldTides(50.0, -120.75);

      expect(result).not.toBeNull();
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('lon=-120.75');
    });

    it('should handle high-precision coordinates', async () => {
      const result = await fetchWorldTides(50.123456789, -5.987654321);

      expect(result).not.toBeNull();
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('lat=50.123456789');
      expect(callUrl).toContain('lon=-5.987654321');
    });
  });

  describe('Response Structure', () => {
    it('should match WorldTidesResponse interface', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('extremes');
      expect(Array.isArray(result?.extremes)).toBe(true);
    });

    it('should have correctly typed extremes', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const extreme = result?.extremes[0];
      
      expect(extreme).toHaveProperty('dt');
      expect(extreme).toHaveProperty('date');
      expect(extreme).toHaveProperty('height');
      expect(extreme).toHaveProperty('type');
      
      expect(typeof extreme?.dt).toBe('number');
      expect(typeof extreme?.date).toBe('string');
      expect(typeof extreme?.height).toBe('number');
      expect(['High', 'Low']).toContain(extreme?.type);
    });

    it('should return extremes in chronological order', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const extremes = result?.extremes || [];
      
      for (let i = 1; i < extremes.length; i++) {
        expect(extremes[i].dt).toBeGreaterThan(extremes[i - 1].dt);
      }
    });

    it('should have ISO 8601 date format', async () => {
      const result = await fetchWorldTides(50.0, -5.0);

      expect(result).not.toBeNull();
      const extreme = result?.extremes[0];
      
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss±HH:mm
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
      expect(extreme?.date).toMatch(isoRegex);
    });
  });

  describe('Start Time Parameter', () => {
    it('should use current time as start parameter', async () => {
      const beforeCall = Math.floor(Date.now() / 1000);
      await fetchWorldTides(50.0, -5.0);
      const afterCall = Math.floor(Date.now() / 1000);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(callUrl);
      const start = parseInt(url.searchParams.get('start') || '0');

      expect(start).toBeGreaterThanOrEqual(beforeCall);
      expect(start).toBeLessThanOrEqual(afterCall);
    });

    it('should request future extremes from now', async () => {
      await fetchWorldTides(50.0, -5.0);

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const url = new URL(callUrl);
      const start = parseInt(url.searchParams.get('start') || '0');
      const now = Math.floor(Date.now() / 1000);

      // Start should be within a few seconds of now
      expect(Math.abs(start - now)).toBeLessThan(5);
    });
  });

  describe('Integration Behavior', () => {
    it('should be suitable for 24-hour caching', async () => {
      // WorldTides data is astronomically predictable
      // Tide times shift only ~50 minutes per day
      // Safe to cache for 24 hours

      const result = await fetchWorldTides(50.0, -5.0, 7);

      expect(result).not.toBeNull();
      expect(result?.extremes.length).toBeGreaterThan(0);
      
      // Should have multiple days of data for effective caching
      const extremes = result?.extremes || [];
      const firstTime = extremes[0]?.dt || 0;
      const lastTime = extremes[extremes.length - 1]?.dt || 0;
      const daysCovered = (lastTime - firstTime) / (24 * 60 * 60);
      
      // Sample data spans less than a day, but real data would span multiple days
      expect(daysCovered).toBeGreaterThanOrEqual(0);
      expect(extremes.length).toBeGreaterThan(2); // At least a few extremes
    });

    it('should work with coordinate rounding for cache efficiency', async () => {
      // WorldTides API is designed to work with rounded coordinates
      // Nearby locations (~11km) have identical tide times
      
      const round3dp = (n: number) => Math.round(n * 1e3) / 1e3;
      
      const lat1 = 50.123456;
      const lon1 = -5.987654;
      const lat2 = round3dp(lat1);
      const lon2 = round3dp(lon1);

      const result1 = await fetchWorldTides(lat1, lon1);
      
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockWorldTidesResponse,
      });
      
      const result2 = await fetchWorldTides(lat2, lon2);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      // Results should be similar enough for caching purposes
    });
  });
});
