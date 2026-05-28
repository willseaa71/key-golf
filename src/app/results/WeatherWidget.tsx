import { Suspense } from "react";
import type { ReactNode } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Umbrella,
  Snowflake,
} from "lucide-react";

const LAT = 43.0831;
const LON = -73.7846;

type WmoEntry = { label: string; icon: ReactNode };
const WMO: Record<number, WmoEntry> = {
  0:  { label: "Clear",          icon: <Sun size={18} className="text-amber-400" /> },
  1:  { label: "Mainly Clear",   icon: <CloudSun size={18} className="text-gray-400" /> },
  2:  { label: "Partly Cloudy",  icon: <CloudSun size={18} className="text-gray-400" /> },
  3:  { label: "Overcast",       icon: <Cloud size={18} className="text-gray-400" /> },
  45: { label: "Foggy",          icon: <Cloud size={18} className="text-gray-300" /> },
  48: { label: "Icy Fog",        icon: <Cloud size={18} className="text-gray-300" /> },
  51: { label: "Light Drizzle",  icon: <CloudRain size={18} className="text-blue-400" /> },
  53: { label: "Drizzle",        icon: <CloudRain size={18} className="text-blue-400" /> },
  55: { label: "Heavy Drizzle",  icon: <CloudRain size={18} className="text-blue-400" /> },
  61: { label: "Light Rain",     icon: <CloudRain size={18} className="text-blue-400" /> },
  63: { label: "Rain",           icon: <CloudRain size={18} className="text-blue-400" /> },
  65: { label: "Heavy Rain",     icon: <CloudRain size={18} className="text-blue-400" /> },
  71: { label: "Light Snow",     icon: <Snowflake size={18} className="text-blue-200" /> },
  73: { label: "Snow",           icon: <Snowflake size={18} className="text-blue-200" /> },
  75: { label: "Heavy Snow",     icon: <Snowflake size={18} className="text-blue-200" /> },
  80: { label: "Showers",        icon: <CloudRain size={18} className="text-blue-400" /> },
  81: { label: "Showers",        icon: <CloudRain size={18} className="text-blue-400" /> },
  82: { label: "Heavy Showers",  icon: <CloudRain size={18} className="text-blue-400" /> },
  95: { label: "Thunderstorm",   icon: <CloudLightning size={18} className="text-amber-500" /> },
  96: { label: "Thunderstorm",   icon: <CloudLightning size={18} className="text-amber-500" /> },
  99: { label: "Thunderstorm",   icon: <CloudLightning size={18} className="text-amber-500" /> },
};

function wmo(code: number): WmoEntry {
  return WMO[code] ?? { label: "Mixed", icon: <CloudSun size={18} className="text-gray-400" /> };
}

// Next Thursday relative to today (or today if today is Thursday)
function nextThursday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 4=Thu
  const daysAhead = day === 4 ? 0 : (4 - day + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysAhead);
  return target.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function fetchWeather() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LON));
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "windspeed_10m_max",
    "weathercode",
  ].join(","));
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("windspeed_unit", "mph");
  url.searchParams.set("timezone", "America/New_York");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      windspeed_10m_max: number[];
      weathercode: number[];
    };
  }>;
}

async function WeatherCard() {
  let data;
  try {
    data = await fetchWeather();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
        <p className="text-xs text-gray-400">Weather unavailable</p>
      </div>
    );
  }

  const thursday = nextThursday();
  const idx = data.daily.time.indexOf(thursday);
  if (idx === -1) return null;

  const high  = Math.round(data.daily.temperature_2m_max[idx]);
  const low   = Math.round(data.daily.temperature_2m_min[idx]);
  const wind  = Math.round(data.daily.windspeed_10m_max[idx]);
  const rain  = data.daily.precipitation_probability_max[idx];
  const code  = data.daily.weathercode[idx];
  const cond  = wmo(code);

  const rainColor =
    rain >= 60 ? "text-blue-600" :
    rain >= 30 ? "text-blue-400" :
    "text-gray-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
        Next round · {formatDate(thursday)} · Saratoga Springs
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        {/* Condition */}
        <div className="flex items-center gap-2">
          {cond.icon}
          <span className="text-sm font-medium text-gray-800">{cond.label}</span>
        </div>
        {/* Temp */}
        <div className="flex items-baseline gap-1 text-sm">
          <span className="font-semibold text-gray-900">{high}°</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">{low}°F</span>
        </div>
        {/* Wind */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Wind size={18} className="text-gray-400" />
          <span>{wind} mph</span>
        </div>
        {/* Rain */}
        <div className={`flex items-center gap-1 text-sm font-medium ${rainColor}`}>
          <Umbrella size={18} className="text-blue-400" />
          <span>{rain}% rain</span>
        </div>
      </div>
    </div>
  );
}

function WeatherSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 animate-pulse">
      <div className="h-3 w-48 bg-gray-200 rounded mb-3" />
      <div className="flex gap-4">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-5 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-16 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export function WeatherWidget() {
  return (
    <Suspense fallback={<WeatherSkeleton />}>
      <WeatherCard />
    </Suspense>
  );
}
