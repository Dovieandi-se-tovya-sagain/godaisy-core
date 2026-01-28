export interface FallbackRectangleOption {
  code: string;
  label: string;
  region: string;
  centerLat: number;
  centerLon: number;
  distanceToShoreKm?: number;
}

const RAW_CSV = `
rectangle_code,region,center_lat,center_lon,distance_to_shore_km
22D6,Portuguese Coast,38.500000,-9.000000,1.00
24E1,Bay of Biscay,43.750000,-6.500000,1.80
25E1,Bay of Biscay,43.750000,-5.500000,3.00
26E1,Bay of Biscay,43.750000,-4.500000,2.20
26D6,Portuguese Coast,40.250000,-9.000000,1.00
27D7,Portuguese Coast,40.750000,-8.500000,2.00
22D8,Galician Coast,43.500000,-9.000000,0.50
21D8,Galician Coast,42.500000,-9.000000,0.60
27F1,Bay of Biscay,46.500000,-1.000000,2.10
28F2,Bay of Biscay,47.000000,-2.000000,1.70
23E1,Bay of Biscay,43.750000,-7.500000,1.00
24E2,Bay of Biscay,43.750000,-7.500000,3.00
28F4,Bay of Biscay,48.000000,-4.000000,1.90
22D7,Galician Coast,43.500000,-8.000000,0.70
28D8,Irish Northwest,54.500000,-9.000000,1.40
25D9,Irish West,53.000000,-10.000000,0.70
27C7,Irish Southwest,51.500000,-10.000000,1.20
28D9,Irish Northwest,54.500000,-10.000000,0.80
26D9,Irish West,53.500000,-10.000000,0.90
20C5,Portuguese Coast,37.500000,-7.500000,1.60
26C7,Irish Southwest,52.000000,-10.000000,0.80
26C8,Irish Southwest,52.000000,-9.000000,1.10
26D6,Portuguese Coast,40.250000,-9.000000,1.00
26D8,Irish West,53.500000,-9.000000,1.30
26D9,Irish West,53.500000,-10.000000,0.90
26E0,Bay of Biscay,43.250000,-4.500000,2.00
26E1,Bay of Biscay,43.750000,-4.500000,2.20
27C7,Irish Southwest,51.500000,-10.000000,1.20
27D7,Portuguese Coast,40.750000,-8.500000,2.00
27D8,Irish West,54.000000,-9.000000,1.60
27D9,Irish West,54.000000,-10.000000,1.10
27F1,Bay of Biscay,46.500000,-1.000000,2.10
28D8,Irish Northwest,54.500000,-9.000000,1.40
28D9,Irish Northwest,54.500000,-10.000000,0.80
28F2,Bay of Biscay,47.000000,-2.000000,1.70
28F4,Bay of Biscay,48.000000,-4.000000,1.90
29D8,Irish Northwest,55.000000,-9.000000,1.70
29D9,Irish Northwest,55.000000,-10.000000,1.20
29F3,Bay of Biscay,48.000000,-3.000000,2.20
30D5,Irish North,55.500000,-6.000000,2.30
30D6,Irish North,55.500000,-7.000000,2.10
30D7,Irish North,55.500000,-8.000000,1.90
30E8,English Channel,49.750000,-0.500000,3.00
30E9,English Channel,49.750000,0.500000,4.00
31C6,Irish Southeast,52.000000,-8.000000,1.30
31C7,Irish Southeast,52.000000,-7.000000,1.60
31E3,Welsh Coast,51.500000,-3.000000,2.70
31E8,English Channel,50.250000,-0.500000,2.00
31E9,English Channel,50.250000,0.500000,3.00
32C6,Irish Southeast,52.500000,-7.000000,1.90
32E4,Welsh Coast,52.000000,-4.000000,2.30
32E5,Irish East,52.500000,-6.000000,2.10
32F1,Dutch Coast,51.250000,1.500000,4.00
33D5,Irish Coast,52.250000,-5.000000,2.00
33E1,Scottish East,56.000000,-3.000000,1.80
33E2,Scottish Southwest,55.000000,-4.000000,2.40
33E3,Scottish Southwest,55.000000,-5.000000,2.00
33E5,Irish East,53.000000,-6.000000,1.80
33F2,Dutch Coast,51.750000,2.500000,3.00
34D6,Irish Coast,52.750000,-4.000000,3.00
34E1,Scottish East,56.500000,-3.000000,2.00
34E3,Scottish Southwest,55.500000,-5.000000,1.80
34E5,Irish East,53.500000,-6.000000,2.00
34F4,Scottish Highlands,56.500000,-6.000000,1.60
34F6,Inner Hebrides,56.500000,-7.000000,1.20
35E1,Scottish East,57.000000,-3.000000,2.30
35E5,Irish East,54.000000,-6.000000,2.20
35F4,Scottish Highlands,57.000000,-6.000000,1.40
35F5,Scottish Highlands,57.000000,-7.000000,1.10
35F6,Inner Hebrides,57.000000,-7.000000,1.00
35G5,Scottish Coast,56.000000,-5.000000,2.80
35G6,Outer Hebrides,57.000000,-8.000000,0.90
36E1,Scottish Northeast,57.500000,-3.000000,2.10
36F4,Scottish Highlands,57.500000,-6.000000,1.70
36F5,Scottish Highlands,57.500000,-7.000000,1.30
36G6,Outer Hebrides,57.500000,-8.000000,0.70
37E1,Scottish Northeast,58.000000,-3.000000,1.90
37F5,Scottish Highlands,58.000000,-7.000000,1.00
37F6,Scottish Highlands,58.000000,-6.000000,1.50
37G6,Outer Hebrides,58.000000,-8.000000,0.80
37H4,Mediterranean,36.500000,-5.000000,1.20
37H5,Mediterranean,36.500000,-4.000000,0.80
37I2,Mediterranean,39.000000,0.000000,1.50
37I3,Mediterranean,39.000000,1.000000,2.10
37J2,Mediterranean,41.500000,2.000000,1.80
37J3,Mediterranean,41.500000,3.000000,2.30
37J7,French Mediterranean,36.750000,0.000000,1.00
38E1,Scottish Northeast,58.500000,-3.000000,1.70
38F4,Scottish Northwest,58.500000,-5.000000,1.80
38F5,Scottish Northwest,58.500000,-6.000000,1.20
38J8,French Mediterranean,37.250000,1.000000,2.00
39E1,Scottish Northeast,59.000000,-3.000000,2.00
39F3,Scottish Northwest,59.000000,-4.000000,2.30
39F4,Scottish Northwest,59.000000,-5.000000,2.10
39K0,French Mediterranean,43.500000,7.000000,1.30
39K1,French Mediterranean,43.500000,8.000000,1.70
40F1,Scottish North,59.500000,-2.000000,2.50
40F2,Scottish North,59.500000,-3.000000,2.20
40F3,Scottish North,59.500000,-4.000000,1.90
40K0,Italian Coast,38.250000,8.500000,2.00
`;

function parseCsvRow(line: string): FallbackRectangleOption {
  const [codeRaw, regionRaw, latRaw, lonRaw, distanceRaw] = line.split(',');
  const code = codeRaw.trim();
  const region = regionRaw.trim();
  const centerLat = Number.parseFloat(latRaw);
  const centerLon = Number.parseFloat(lonRaw);
  const distanceToShoreKm = distanceRaw ? Number.parseFloat(distanceRaw) : undefined;

  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) {
    throw new Error(`Invalid rectangle centre coordinates for code ${code}`);
  }

  return {
    code,
    label: region,
    region,
    centerLat,
    centerLon,
    distanceToShoreKm,
  } satisfies FallbackRectangleOption;
}

export const FALLBACK_RECTANGLE_OPTIONS: FallbackRectangleOption[] = RAW_CSV.trim()
  .split('\n')
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map(parseCsvRow);
  // NOTE: CSV is already ordered with temperature-enabled rectangles first
  // DO NOT sort alphabetically or 20C5 (no temp data) will be first!

export const FALLBACK_RECTANGLE_SOURCE_ROWS = RAW_CSV;
