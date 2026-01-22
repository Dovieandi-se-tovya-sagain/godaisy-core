import type { MarineRow } from "@/lib/types";

export default function ActivityOutlooks({ rows }: { rows: MarineRow[] }) {
  const midday = rows[Math.min(12, rows.length - 1)];
  const score = (ok: boolean) => (ok ? "Good" : "Poor");

  return (
    <section className="activity-grid">
      <article>
        <h4>Surf</h4>
        <p>Wave: {midday ? midday.wave.toFixed(1) : "--"} m</p>
        <p>Rating: {score(midday ? midday.wave > 1.0 : false)}</p>
      </article>
      <article>
        <h4>SUP</h4>
        <p>Wind: {midday ? midday.wind.toFixed(1) : "--"} m/s</p>
        <p>Rating: {score(midday ? midday.wind < 4.0 : false)}</p>
      </article>
      <article>
        <h4>Boat</h4>
        <p>Visibility: {midday ? midday.vis : "--"} km</p>
        <p>Rating: {score(midday ? midday.vis > 5 : false)}</p>
      </article>
      <article>
        <h4>Kayak</h4>
        <p>Current: {midday ? midday.current : "--"} kts</p>
        <p>Rating: {score(midday ? Number(midday.current) < 2 : false)}</p>
      </article>
    </section>
  );
}
