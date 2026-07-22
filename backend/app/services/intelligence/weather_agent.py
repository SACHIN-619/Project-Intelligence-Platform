"""
app/services/intelligence/weather_agent.py
===========================================
Weather Risk Agent — pulls live 14-day forecast from Open-Meteo
(completely free API, no key needed) and flags outdoor EPC tasks
at risk from monsoon, extreme heat, or high winds.

Only runs when settings.feature_weather_agent_enabled = True.

Innovative because no EPC tool proactively correlates the weather
forecast with construction task schedules automatically.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Outdoor task keywords ─────────────────────────────────────────────────────
WEATHER_SENSITIVE_KEYWORDS = [
    "civil", "foundation", "excavation", "concrete", "structural",
    "steel", "erection", "roofing", "outdoor", "crane", "piling",
    "earthwork", "grading", "waterproofing", "external", "site",
    "basement", "trench", "laying", "cable laying",
]

# ── Weather thresholds ────────────────────────────────────────────────────────
HEAVY_RAIN_MM   = 20.0    # mm/day  → delays concrete + crane ops
EXTREME_HEAT_C  = 42.0    # °C      → OSHA limits outdoor work hours
STRONG_WIND_KMH = 50.0    # km/h    → crane operations suspended


def is_weather_sensitive(task_name: str) -> bool:
    """Return True if the task name suggests outdoor / weather-exposed work."""
    name_lower = task_name.lower()
    return any(kw in name_lower for kw in WEATHER_SENSITIVE_KEYWORDS)


async def get_14day_forecast(
    latitude: float = 12.9716,    # default: Bangalore
    longitude: float = 77.5946,
) -> Optional[dict]:
    """
    Fetch 14-day daily forecast from Open-Meteo (free, no API key).
    Returns raw API dict or None on network failure.
    """
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        "&daily=precipitation_sum,temperature_2m_max,windspeed_10m_max"
        "&timezone=Asia%2FKolkata"
        "&forecast_days=14"
    )
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            logger.info(f"[WeatherAgent] Forecast fetched for {latitude},{longitude}")
            return resp.json()
    except Exception as e:
        logger.warning(f"[WeatherAgent] Forecast fetch failed: {e}")
        return None


async def analyse_weather_risks(
    tasks: List[dict],
    latitude: float = 12.9716,
    longitude: float = 77.5946,
) -> List[dict]:
    """
    Cross-reference 14-day weather forecast against outdoor tasks.

    tasks: list of dicts with keys:
        name, planned_start (YYYY-MM-DD), planned_finish (YYYY-MM-DD)

    Returns list of weather risk dicts compatible with RiskItem schema
    (risk_type="weather").
    """
    forecast = await get_14day_forecast(latitude, longitude)
    if not forecast:
        return []

    daily   = forecast.get("daily", {})
    dates   = daily.get("time", [])
    rain    = daily.get("precipitation_sum", [])
    temps   = daily.get("temperature_2m_max", [])
    winds   = daily.get("windspeed_10m_max", [])

    weather_risks: List[dict] = []

    for task in tasks:
        task_name  = task.get("name", "")
        task_start = task.get("planned_start", "")
        task_end   = task.get("planned_finish", "")

        if not is_weather_sensitive(task_name) or not task_start:
            continue

        try:
            start_dt = datetime.strptime(task_start[:10], "%Y-%m-%d")
            end_dt   = (
                datetime.strptime(task_end[:10], "%Y-%m-%d")
                if task_end
                else start_dt + timedelta(days=7)
            )
        except ValueError:
            continue

        # Check each forecast day against the task window
        for i, date_str in enumerate(dates):
            try:
                forecast_dt = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                continue

            if not (start_dt <= forecast_dt <= end_dt):
                continue

            rain_mm  = rain[i]  if i < len(rain)  else 0
            temp_c   = temps[i] if i < len(temps)  else 0
            wind_kmh = winds[i] if i < len(winds)  else 0

            risk_msg  = None
            severity  = "low"
            prob      = 0.0
            impact    = 1

            if rain_mm >= HEAVY_RAIN_MM:
                risk_msg = (
                    f"Heavy rain forecast ({rain_mm:.0f}mm) on {date_str} may delay "
                    f"'{task_name}'. Concrete curing and crane operations should be rescheduled."
                )
                severity = "high" if rain_mm > 40 else "medium"
                prob     = min(0.95, rain_mm / 50)
                impact   = 3 if severity == "high" else 2

            elif temp_c >= EXTREME_HEAT_C:
                risk_msg = (
                    f"Extreme heat ({temp_c:.0f}°C) on {date_str} will limit outdoor work hours "
                    f"for '{task_name}' per OSHA heat-stress guidelines."
                )
                severity = "medium"
                prob     = 0.7
                impact   = 1

            elif wind_kmh >= STRONG_WIND_KMH:
                risk_msg = (
                    f"Strong winds ({wind_kmh:.0f} km/h) on {date_str} will suspend crane "
                    f"operations during '{task_name}'."
                )
                severity = "high"
                prob     = 0.85
                impact   = 2

            if risk_msg:
                weather_risks.append({
                    "task_name":     task_name,
                    "risk_type":     "weather",
                    "severity":      severity,
                    "probability":   prob,
                    "impact_days":   impact,
                    "risk_score":    round(prob * impact * 3, 1),
                    "explanation":   risk_msg,
                    "confidence":    0.75,
                    "evidence_hints": [
                        f"Open-Meteo forecast: {date_str}",
                        f"Task window: {task_start} → {task_end or 'ongoing'}",
                    ],
                    "forecast_date": date_str,
                })
                break  # one risk per task per analysis run

    logger.info(
        f"[WeatherAgent] Found {len(weather_risks)} weather risks "
        f"across {len(tasks)} tasks"
    )
    return weather_risks