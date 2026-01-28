import { useEffect, useState } from "react";

type IssWindow = {
  risetimeISO: string;
  endtimeISO: string;
  durationSec: number;
};

type NextNightPassResponse = {
  ok: boolean;
  pass?: {
    risetime: string;
    duration: number;
    mag: number;
    direction: string;
    maxEl: number;
  };
  sunset?: string;
  nextSunrise?: string;
  error?: string;
};

type Heartbeat = { ok: boolean; timestamp?: number; position?: { lat: number; lon: number } };

function fmtRange(startISO: string, endISO: string) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const tf = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${tf.format(s)}–${tf.format(e)}`;
}

export function IssCard({ lat, lon }: { lat: number; lon: number }) {
  const [passes, setPasses] = useState<IssWindow[] | null>(null);
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [v, h] = await Promise.all([
          fetch(`/api/iss-next-night-pass?lat=${lat}&lon=${lon}`, { cache: "no-store" })
            .then(r => r.json() as Promise<NextNightPassResponse>),
          fetch(`/api/iss-heartbeat`, { cache: "no-store" })
            .then(r => r.json() as Promise<Heartbeat>)
            .catch(() => ({ ok: false })),
        ]);
        
        if (!cancelled) {
          // Convert from new API format to our expected format
          if (v.ok && v.pass) {
            const pass = v.pass;
            const risetime = new Date(pass.risetime);
            const endtime = new Date(risetime.getTime() + pass.duration * 1000);
            
            setPasses([{
              risetimeISO: pass.risetime,
              endtimeISO: endtime.toISOString(),
              durationSec: pass.duration
            }]);
          } else {
            setPasses([]);
          }
          
          setHb(h);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (loading) return <div className="card">Checking ISS passes…</div>;

  return (
    <div className="card">
      <strong>ISS tonight</strong>
      {hb && (
        <div style={{ fontSize: 12, opacity: 0.8, margin: "4px 0" }}>
          Service: {hb.ok ? "Open Notify online" : "fallback active"}
        </div>
      )}

      {!passes || passes.length === 0 ? (
        <div>No decent night-time passes here tonight.</div>
      ) : (
        <ul>
          {passes.map((p, i) => (
            <li key={i}>
              <em>Look up at</em>{" "}
              {fmtRange(p.risetimeISO, p.endtimeISO)} ({Math.round(p.durationSec / 60)} min)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}