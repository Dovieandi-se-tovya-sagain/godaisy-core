import Image from "next/image";
import dayjs from "dayjs";
import type { OWMForecastSlot } from "@/lib/types";

export default function ForecastCards({ slots }: { slots: OWMForecastSlot[] }) {
  return (
    <section className="forecast-grid">
      {slots.map(s => {
        const t = dayjs.unix(s.dt);
        const precip = s.rain?.["3h"] ?? s.snow?.["3h"] ?? 0;
        const popPct = Math.round(s.pop * 100);

        return (
          <article key={s.dt} className="homepage-card" aria-label={s.weather[0].description}>
            <header className="card-header">{t.format("ddd HH:mm")}</header>
            <div className="card-condition">
              <Image
                src={`https://openweathermap.org/img/wn/${s.weather[0].icon}@2x.png`}
                width={64}
                height={64}
                alt={s.weather[0].description}
              />
              <span className="temperature">{Math.round(s.main.temp)}°</span>
              <span>{s.weather[0].description}</span>
            </div>
            <div className="weather-stats">
              <span>
                💨 {s.wind.speed.toFixed(1)} m/s
                {s.wind.gust && (
                  <small> (gust {s.wind.gust.toFixed(1)} m/s)</small>
                )}
              </span>
              <span>
                🌧 {precip.toFixed(1)} mm <small>({popPct}%)</small>
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
