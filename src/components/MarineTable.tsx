import type { MarineRow } from "../lib/types";
import SwellArrow from "./SwellArrow";

export default function MarineTable({ rows }: { rows: MarineRow[] }) {
  return (
    <div className="table-wrap">
      <table className="marine-table" aria-label="Marine forecast detail">
        <thead>
          <tr>
            {[
              "Time",
              "Water Temp",
              "Wave m",
              "Wind m/s",
              "Gust m/s",
              "Swell m",
              "Dir",
              "Period s",
              "Vis km",
              "Current kts",
            ].map(col => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.iso}>
              <td>{r.local}</td>
              <td className={r.className}>
                💧 {r.water.toFixed(1)}°C
              </td>
              <td>{r.wave.toFixed(1)}</td>
              <td>{r.wind.toFixed(1)}</td>
              <td>{r.gust?.toFixed(1) ?? "--"}</td>
              <td>{r.swell.toFixed(1)}</td>
              <td>
                <SwellArrow deg={r.swellDir} />
              </td>
              <td>{r.period}</td>
              <td>{r.vis}</td>
              <td>{r.current}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
