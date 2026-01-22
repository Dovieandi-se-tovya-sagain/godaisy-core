import React, { useMemo, useState, useEffect } from "react";

type TideSample = { ts: number; height: number }; // ts = epoch ms, height in metres
type Extremum = { ts: number; height: number; type: "high" | "low" };

type Props = {
  /** Tide samples covering at least now → now+24h (ideally every 15–30 min). */
  samples: TideSample[];

  /** If not provided, the component will auto-detect the next two highs and lows. */
  extrema?: Extremum[];

  /** For tests/storybook you can pin "now"; otherwise Date.now() is used. */
  nowTs?: number;

  /** Icon sources for your house style. Prefer your existing SVGs. */
  highIconSrc?: string;          // e.g. "/weather-icons/design/final/tide-high.svg"
  lowIconSrc?: string;           // e.g. "/weather-icons/design/final/tide-low.svg"
  iconSize?: number;             // px, default 28

  /** Size of the SVG viewBox (the element is responsive). */
  width?: number;                // viewBox width, default 900
  height?: number;               // viewBox height, default 280

  /** Optional UI flags */
  showBaseline?: boolean;        // subtle baseline under the wave
  className?: string;            // Tailwind container styles
};

/* -------------------------- Geometry helpers -------------------------- */

/** Catmull–Rom to cubic Bézier SVG path (smooth curve through all points). */
function catmullRomToBezierPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const pts = [...points];
  // pad ends so the spline starts/ends smoothly
  pts.unshift(points[0]);
  pts.push(points[points.length - 1]);

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Simple extrema finder. Returns local maxima/minima within [start,end]. */
function findExtrema(
  samples: TideSample[],
  windowStart: number,
  windowEnd: number,
  maxPerType = 2
): Extremum[] {
  const within = samples.filter(s => s.ts >= windowStart && s.ts <= windowEnd);
  const out: Extremum[] = [];
  for (let i = 1; i < within.length - 1; i++) {
    const prev = within[i - 1], cur = within[i], next = within[i + 1];
    if (cur.height >= prev.height && cur.height >= next.height) {
      out.push({ ts: cur.ts, height: cur.height, type: "high" });
    } else if (cur.height <= prev.height && cur.height <= next.height) {
      out.push({ ts: cur.ts, height: cur.height, type: "low" });
    }
  }
  // Keep the next couple of each from "now"
  const now = windowStart;
  const highs = out
    .filter(e => e.type === "high" && e.ts >= now)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, maxPerType);
  const lows = out
    .filter(e => e.type === "low" && e.ts >= now)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, maxPerType);
  return [...highs, ...lows].sort((a, b) => a.ts - b.ts);
}

/* ------------------------------ Component ----------------------------- */

export default function PrettyTideWaveRolling({
  samples,
  extrema,
  nowTs,
  highIconSrc = "/weather-icons/design/final/tide-high.svg",
  lowIconSrc = "/weather-icons/design/final/tide-low.svg",
  iconSize = 40,
  width = 900,
  height = 280,
  showBaseline = true,
  className = "",
}: Props) {
  const [isClient, setIsClient] = useState(false);

  // Only render on client to avoid hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only calculate these values on the client to avoid hydration issues
  const now = isClient ? (nowTs ?? Date.now()) : 0;
  const in24h = now + 24 * 60 * 60 * 1000;

  const {
    path,
    fillPath,
    xScale,
    yScale,
    baseY,
    markers,
  } = useMemo(() => {
    // Guard - return empty state if not client or no samples
    if (!isClient || !samples?.length) {
      const noop = (n: number) => n;
      return {
        path: "",
        fillPath: "",
        xScale: noop,
        yScale: noop,
        minH: 0,
        maxH: 1,
        firstX: 0,
        lastX: width,
        baseY: height,
        markers: [] as Extremum[],
      };
    }

    // Filter/extend to our rolling window [now, now+24h]
    const windowed = samples
      .filter(s => s.ts >= now && s.ts <= in24h)
      .sort((a, b) => a.ts - b.ts);

    // If sparse at edges, softly pad with nearest edge points (better fill)
    const padded: TideSample[] = [...windowed];
    if (padded.length > 0 && padded[0].ts > now) {
      padded.unshift({ ts: now, height: padded[0].height });
    }
    if (padded.length > 0 && padded[padded.length - 1].ts < in24h) {
      padded.push({ ts: in24h, height: padded[padded.length - 1].height });
    }

    const minH = Math.min(...padded.map(p => p.height));
    const maxH = Math.max(...padded.map(p => p.height));

    const padX = 16;
    const padTop = 14;
    const padBottom = 28;
    const plotW = width - padX * 2;
    const plotH = height - padTop - padBottom;

    const xScale = (ts: number) => padX + ((ts - now) / (in24h - now)) * plotW;

    const yScale = (h: number) => {
      if (maxH === minH) return padTop + plotH / 2;
      const r = (h - minH) / (maxH - minH); // 0..1
      return padTop + (1 - r) * plotH;      // higher tide = visually higher (smaller y)
    };

    const xy = padded.map(p => ({ x: xScale(p.ts), y: yScale(p.height) }));
    const path = catmullRomToBezierPath(xy);

    const firstX = xy[0]?.x ?? padX;
    const lastX = xy[xy.length - 1]?.x ?? width - padX;
    const baseY = height - padBottom + 16;

    const fillPath = `${path} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    const markers = extrema && extrema.length
      ? extrema.filter(e => e.ts >= now && e.ts <= in24h)
      : findExtrema(samples, now, in24h, 2);

    return { path, fillPath, xScale, yScale, minH, maxH, firstX, lastX, baseY, markers };
  }, [samples, extrema, now, in24h, width, height, isClient]);

  // Show loading state during server-side rendering to prevent hydration mismatch
  if (!isClient) {
    return (
      <div
        className={`rounded-2xl p-4 bg-base-200 shadow-xl ${className}`}
        role="img"
        aria-label="Loading tide chart..."
      >
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-gray-500">Loading tide chart...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-4 bg-base-200 shadow-xl ${className}`}
      role="img"
      aria-label="24-hour tide chart showing current height and upcoming high/low tides"
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Gradients & soft glow */}
        <defs>
          <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.45)" />
            <stop offset="60%" stopColor="rgba(59,130,246,0.18)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.04)" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Optional baseline */}
        {showBaseline && (
          <line
            x1={0}
            y1={baseY}
            x2={width}
            y2={baseY}
            stroke="rgba(59,130,246,0.15)"
            strokeWidth={1}
          />
        )}

        {/* Time axis ticks (every 6 hours) */}
        {(() => {
          const ticks: number[] = [];
          for (let h = 0; h <= 24; h += 6) ticks.push(now + h * 60 * 60 * 1000);
          return (
            <g>
              {ticks.map((ts, i) => (
                <g key={i}>
                  <line
                    x1={xScale(ts)}
                    y1={baseY - 6}
                    y2={baseY}
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={1}
                  />
                  {(() => {
                    // Use UTC to ensure consistent formatting across server/client
                    const date = new Date(ts);
                    const hours = date.getUTCHours();
                    const label = hours === 0 ? '12 AM' : hours === 12 ? '12 PM' : hours < 12 ? `${hours} AM` : `${hours - 12} PM`;
                    return (
                      <text
                        x={xScale(ts)}
                        y={baseY - 16}
                        textAnchor="middle"
                        fontSize={24}
                        fill="#ffffff"
                        stroke="#000000"
                        strokeWidth={0.5}
                      >
                        {label}
                      </text>
                    );
                  })()}
                </g>
              ))}
            </g>
          );
        })()}

        {/* Filled dreamy wave */}
        <path d={fillPath} fill="url(#tideGradient)" />

        {/* Crisp wave stroke */}
        <path
          d={path}
          fill="none"
          stroke="rgba(59,130,246,0.9)"
          strokeWidth={3}
          filter="url(#softGlow)"
        />

        {/* Current time marker */}
        <line
          x1={xScale(now)}
          y1={0}
          x2={xScale(now)}
          y2={height}
          stroke="rgba(255,255,255,0.9)"
          strokeDasharray="4 3"
          strokeWidth={1.5}
        />
        <circle
          cx={xScale(now)}
          cy={0 + 10}
          r={3}
          fill="rgba(255,255,255,0.9)"
        >
          <title>Now</title>
        </circle>

        {/* Extrema markers (icons) */}
        {markers.map((m, i) => {
          const isLow = m.type === "low";
          const href = isLow ? lowIconSrc : highIconSrc;
          const label = `${isLow ? "Low" : "High"} ${m.height.toFixed(1)} m`;
          const size = iconSize * 3; // make both high and low same large size
          const x = xScale(m.ts);
          const yCurve = yScale(m.height);
          const y = isLow
            ? Math.min(height - size / 2 - 4, baseY + size / 2 + 8) // below axis
            : Math.max(size / 2 + 4, yCurve - size / 2 - 8); // above the curve, clamped inside viewBox
          // Build caption content: show the local time for both LOW and HIGH
          // Use UTC to ensure consistent formatting across server/client
          const date = new Date(m.ts);
          const hours = date.getUTCHours();
          const minutes = date.getUTCMinutes();
          const hourStr = hours === 0 ? '12' : hours === 12 ? '12' : hours < 12 ? `${hours}` : `${hours - 12}`;
          const ampm = hours < 12 ? 'AM' : 'PM';
          const captionText = `${hourStr}:${minutes.toString().padStart(2, '0')} ${ampm}`;
          const fontSize = 24; // unified label size
          const bubbleWidth = 110;
          const bubbleHeight = 34;
          const bubbleX = -bubbleWidth / 2;
          // Align chip so its TOP sits just below the baseline (offset px)
          const offsetBelowBaseline = 46; // px (move chips 20px further down)
          const desiredCenterY = baseY + offsetBelowBaseline + bubbleHeight / 2;
          const captionY = Math.min(height - bubbleHeight / 2 - 4, desiredCenterY);
          return (
            <g key={`${m.type}-${m.ts}-${i}`} transform={`translate(${x}, ${y})`}>
              <image
                href={href}
                x={-size / 2 - 20}
                y={-size / 2}
                width={size}
                height={size}
                aria-label={label}
              />
              {/* Caption bubble: same line for all */}
              <g transform={`translate(0, ${captionY - y})`}>
                <rect
                  x={bubbleX}
                  y={-bubbleHeight / 2}
                  rx={6}
                  ry={6}
                  width={bubbleWidth}
                  height={bubbleHeight}
                  fill="rgba(17,24,39,0.6)"
                />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fill="white"
                >
                  {captionText}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
