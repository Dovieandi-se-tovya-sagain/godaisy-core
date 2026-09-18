/**
 * Subpath entry: `@dovieandi-se-tovya-sagain/godaisy-core/MapPicker`.
 *
 * 🔴 This exists because importing the map through the barrel drags the whole
 * library in, and two of the things it drags are **unresolvable**.
 *
 * `src/index.ts` re-exports everything, and the package has no
 * `"sideEffects": false`, so a bundler cannot tree-shake the rest away. Two of
 * those modules import packages this library does not declare:
 *
 *   - `src/lib/services/weatherService.ts` imports `openmeteo`, which is in
 *     **devDependencies** only
 *   - `src/lib/capacitor/*` import `@capacitor/device`, declared **nowhere**
 *
 * Both are listed as `external` in `tsup.config.ts`, so the import survives
 * into `dist` for the consumer's bundler to resolve — and a consumer that does
 * not have them gets a hard `Module not found` **build failure**. That never
 * surfaced before because every previous consumer used this package
 * server-side, where those imports land in webpack's `externals`. Grow Daisy is
 * the first to import it into a browser bundle, and it broke immediately.
 *
 * Importing from here instead touches **only** `MapPicker` and the Leaflet
 * chunk it lazily loads, so:
 *
 *   - no `openmeteo`, no `@capacitor/*`, nothing to ignore or shim
 *   - ~127 kB rather than ~392 kB, the difference being a `@js-temporal`
 *     polyfill a map has no use for
 *
 * ⚠️ The barrel export in `src/index.ts` is kept for compatibility — removing
 * it would be a breaking change for anyone already on 1.1.0. Prefer this path.
 *
 * The real fix is for this library to declare its dependencies and set
 * `"sideEffects": false`, but that is an audit of ~50 files that predate this
 * component, and shipping a safe path now beats blocking on it.
 */
export { MapPicker } from './components/MapPicker';
export type {
  MapPickerProps,
  MapPickerCoords,
  MapPickerSearchResult,
} from './components/MapPicker';
