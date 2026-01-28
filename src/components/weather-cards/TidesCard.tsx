import React from 'react';
import Image from 'next/image';
import PrettyTideWaveRolling from '../PrettyTideWaveRolling';
import { TideEvent } from '../../types/weather';

interface TidesCardProps {
  weather: { tides?: TideEvent[] };
  tideState: {
    text: string;
    icon?: string | null;
    nextTimeISO?: string | null;
  };
  remMs?: number | null;
  remH?: number;
  remM?: number;
  remS?: number;
  tidePhase?: string | null;
}

type CSSVarStyle = React.CSSProperties & { '--value'?: number | string };

interface TideSample { ts: number; height: number }
interface TideExtremum { ts: number; height: number; type: 'high' | 'low' }

// Helper functions
const synthesizeTideSamplesFromExtrema = (events: TideExtremum[]): TideSample[] => {
  if (!events || events.length === 0) return [];
  const sortedEvents = events.slice().sort((a, b) => a.ts - b.ts);
  if (sortedEvents.length < 2) return [];

  const samples: TideSample[] = [];
  const now = Date.now();
  const windowStart = now - 6 * 60 * 60 * 1000; // 6 hours ago
  const windowEnd = now + 18 * 60 * 60 * 1000; // 18 hours ahead

  // Extrapolation if we have >=4 events
  if (sortedEvents.length >= 4) {
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const secondLastEvent = sortedEvents[sortedEvents.length - 2];
    const thirdLastEvent = sortedEvents[sortedEvents.length - 3];
    const fourthLastEvent = sortedEvents[sortedEvents.length - 4];
    const cycle1 = secondLastEvent.ts - fourthLastEvent.ts;
    const cycle2 = lastEvent.ts - thirdLastEvent.ts;
    const avgCycle = (cycle1 + cycle2) / 2;
    const lastType = lastEvent.type;
    const nextType: 'high' | 'low' = lastType === 'high' ? 'low' : 'high';
    const nextNextType: 'high' | 'low' = nextType === 'high' ? 'low' : 'high';
    const nextHeight = nextType === 'high' ? Math.max(lastEvent.height, secondLastEvent.height) : Math.min(lastEvent.height, secondLastEvent.height);
    sortedEvents.push(
      { ts: lastEvent.ts + avgCycle, height: nextHeight, type: nextType },
      { ts: lastEvent.ts + avgCycle * 2, height: nextNextType === 'high' ? Math.max(lastEvent.height, secondLastEvent.height) : Math.min(lastEvent.height, secondLastEvent.height), type: nextNextType }
    );
  }

  const intervalMs = 15 * 60 * 1000; // 15 minutes
  for (let ts = windowStart; ts <= windowEnd; ts += intervalMs) {
    let beforeEvent: TideExtremum | null = null;
    let afterEvent: TideExtremum | null = null;
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      if (sortedEvents[i].ts <= ts && sortedEvents[i + 1].ts >= ts) {
        beforeEvent = sortedEvents[i];
        afterEvent = sortedEvents[i + 1];
        break;
      }
    }
    if (beforeEvent && afterEvent) {
      const duration = afterEvent.ts - beforeEvent.ts;
      const elapsed = ts - beforeEvent.ts;
      const ratio = elapsed / duration;
      const heightDiff = afterEvent.height - beforeEvent.height;
      const baseHeight = beforeEvent.height + (heightDiff * ratio);
      const waveAmplitude = Math.abs(heightDiff) * 0.3;
      const sineModulation = waveAmplitude * Math.sin(ratio * Math.PI);
      const height = baseHeight + sineModulation;
      samples.push({ ts, height });
    } else if (beforeEvent && !afterEvent) {
      samples.push({ ts, height: beforeEvent.height });
    } else if (!beforeEvent && afterEvent) {
      samples.push({ ts, height: afterEvent.height });
    }
  }

  sortedEvents.forEach(event => {
    if (event.ts >= windowStart && event.ts <= windowEnd) {
      const existingIndex = samples.findIndex(s => Math.abs(s.ts - event.ts) < intervalMs / 2);
      if (existingIndex >= 0) samples[existingIndex] = { ts: event.ts, height: event.height };
      else samples.push({ ts: event.ts, height: event.height });
    }
  });

  return samples.sort((a, b) => a.ts - b.ts);
};

const getTideTips = (phase: string) => {
  const tips = {
    high: [
      { icon: 'tide-high', title: 'Best for photos', detail: 'High water creates dramatic coastal scenes' },
      { icon: 'tide-high', title: 'Deep water activities', detail: 'Swimming, kayaking, and boating conditions optimal' }
    ],
    low: [
      { icon: 'tide-low', title: 'Beach exploration', detail: 'Tide pools and rock formations exposed' },
      { icon: 'tide-low', title: 'Beach combing', detail: 'Best time to search for shells and sea glass' }
    ],
    rising: [
      { icon: 'tide-rising', title: 'Fishing opportunities', detail: 'Fish move in with rising water' },
      { icon: 'tide-rising', title: 'Launching boats', detail: 'Water level increasing for easier access' }
    ],
    falling: [
      { icon: 'tide-falling', title: 'Safe shore time', detail: 'Water receding - good for beach walks' },
      { icon: 'tide-falling', title: 'Rock pool hunting', detail: 'Exposed areas reveal marine life' }
    ]
  } as const;
  return tips[phase as keyof typeof tips] || [];
};

// Demo tide sequence for fallback
const tideSeq = [
  { time: '06:15', height: 0.3, kind: 'Low tide' },
  { time: '12:30', height: 3.2, kind: 'High tide' },
  { time: '18:45', height: 0.5, kind: 'Low tide' },
  { time: '01:00', height: 3.0, kind: 'High tide' },
];

export const TidesCard: React.FC<TidesCardProps> = ({
  weather,
  tideState = { text: "Tides", icon: null, nextTimeISO: null },
  remMs = null,
  remH = 0,
  remM = 0,
  remS = 0,
  tidePhase = null,
}) => {
  const tips = tidePhase ? getTideTips(tidePhase) : [];

  return (
    <div className="card weather-card-bg p-4">
      <h3 className="card__header-title text-white flex items-center gap-3">
        {tideState.text}
        {tideState.icon && (
          <Image
            src={tideState.icon}
            alt=""
            width={48}
            height={48}
            className="w-12 h-12 md:w-12 md:h-12"
            sizes="(min-width: 768px) 48px, 40px"
          />
        )}
        {remMs != null && (
          <span className="countdown font-mono text-sm">
            <span style={{ '--value': remH } as CSSVarStyle}></span>h:
            <span style={{ '--value': remM } as CSSVarStyle}></span>m:
            <span style={{ '--value': remS } as CSSVarStyle}></span>s
          </span>
        )}
      </h3>

      {Array.isArray(weather?.tides) && weather.tides.length >= 2 ? (
        (() => {
          const raw = (weather.tides || [])
            .filter((e) => e && e.timeISO)
            .map((e) => ({
              time: String(e.timeISO),
              type: (String(e.type).toLowerCase().includes('high') ? 'high' : 'low') as 'high' | 'low',
              height: typeof e.heightM === 'number' ? e.heightM : e.heightM != null ? Number(e.heightM) : 0,
            }));

          const nowTs = Date.now();
          const endTs = nowTs + 24 * 60 * 60 * 1000;
          const sorted = raw.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

          let beforeIdx = -1;
          for (let i = 0; i < sorted.length; i++) {
            const t = new Date(sorted[i].time).getTime();
            if (t < nowTs) beforeIdx = i; else break;
          }

            const windowed = sorted.filter((e) => {
              const t = new Date(e.time).getTime();
              return t >= nowTs && t <= endTs;
            });

            const extras: typeof sorted = [];
            if (beforeIdx >= 0) extras.push(sorted[beforeIdx]);
            const firstAfterEndIdx = sorted.findIndex((e) => new Date(e.time).getTime() > endTs);
            if (firstAfterEndIdx >= 0) extras.push(sorted[firstAfterEndIdx]);

            const events = windowed.length
              ? [...extras.slice(0, 1), ...windowed, ...extras.slice(1, 2)]
              : sorted;
            const tideExtrema: TideExtremum[] = events.map((e) => ({
              ts: new Date(e.time).getTime(),
              height: e.height,
              type: e.type,
            }));
            const samples = synthesizeTideSamplesFromExtrema(tideExtrema);

            return (
              <PrettyTideWaveRolling
                samples={samples}
                extrema={tideExtrema}
                highIconSrc="/weather-icons/design/fill/final/tide-high.svg"
                lowIconSrc="/weather-icons/design/fill/final/tide-low.svg"
                className="bg-slate-800/15"
              />
            );
        })()
      ) : (
        (() => {
          const today = new Date();
          const isoFor = (hhmm: string) => {
            const [hh, mm] = hhmm.split(':').map(Number);
            const d = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              hh % 24,
              mm || 0,
              0,
              0
            );
            return d.toISOString();
          };

          const events = tideSeq.map((e) => ({
            time: isoFor(e.time),
            type: (e.kind.toLowerCase().includes('high') ? 'high' : 'low') as 'high' | 'low',
            height: e.height,
          }));

          const tideExtrema: TideExtremum[] = events.map((e) => ({
            ts: new Date(e.time).getTime(),
            height: e.height,
            type: e.type,
          }));
          const samples = synthesizeTideSamplesFromExtrema(tideExtrema);

          return (
            <PrettyTideWaveRolling
              samples={samples}
              extrema={tideExtrema}
              highIconSrc="/weather-icons/design/fill/final/tide-high.svg"
              lowIconSrc="/weather-icons/design/fill/final/tide-low.svg"
              className="bg-slate-800/15"
            />
          );
        })()
      )}

      {tidePhase && (
        <details className="mt-4">
          <summary className="flex items-center gap-2 cursor-pointer">
            <Image
              src={
                tidePhase === 'high' || tidePhase === 'rising'
                  ? '/weather-icons/design/fill/final/tide-high.svg'
                  : '/weather-icons/design/fill/final/tide-low.svg'
              }
              alt=""
              width={24}
              height={24}
              sizes="24px"
              className="w-6 h-6"
            />
            <span className="font-medium">Tide tips</span>
            <span className="badge badge-ghost badge-sm capitalize">{tidePhase}</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {tips.map((tip, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <Image
                  src={
                    tip.icon === 'tide-high' || tip.icon === 'tide-rising'
                      ? '/weather-icons/design/fill/final/tide-high.svg'
                      : '/weather-icons/design/fill/final/tide-low.svg'
                  }
                  alt=""
                  width={20}
                  height={20}
                  sizes="20px"
                  className="w-5 h-5 mt-0.5 opacity-80"
                />
                <div>
                  <div className="text-sm font-medium">{tip.title}</div>
                  <div className="text-xs opacity-80">{tip.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
