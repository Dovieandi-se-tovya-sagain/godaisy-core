import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CopernicusFetchOptions,
  CopernicusMarineBundle,
  CopernicusProvider,
} from './types';

const moduleFilename = fileURLToPath(import.meta.url);
const moduleDirname = path.dirname(moduleFilename);
const FIXTURE_PATH = path.join(moduleDirname, '__fixtures__', 'asturias-mock.json');

let cachedBundle: CopernicusMarineBundle | null = null;

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

async function loadFixture(): Promise<CopernicusMarineBundle> {
  if (cachedBundle) {
    return cachedBundle;
  }

  const raw = await fs.readFile(FIXTURE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as CopernicusMarineBundle;
  cachedBundle = parsed;
  return parsed;
}

export async function fetchCopernicusBundleMock(
  _options: CopernicusFetchOptions
): Promise<CopernicusMarineBundle> {
  const bundle = clone(await loadFixture());
  const now = new Date().toISOString();

  return {
    ...bundle,
    generatedAt: now,
    physics: {
      ...bundle.physics,
      source: 'mock',
    },
    biogeochemical: bundle.biogeochemical
      ? {
          ...bundle.biogeochemical,
          source: 'mock',
        }
      : undefined,
    waves: bundle.waves
      ? {
          ...bundle.waves,
          source: 'mock',
        }
      : undefined,
  };
}

export class MockCopernicusProvider implements CopernicusProvider {
  async fetchBundle(options: CopernicusFetchOptions): Promise<CopernicusMarineBundle> {
    return fetchCopernicusBundleMock(options);
  }
}
