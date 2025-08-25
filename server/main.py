from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import time
import os
import asyncio


ERGAST_API = os.getenv("ERGAST_API", "https://ergast.com/api/f1")

app = FastAPI(title="Formula-Uno API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_cache: dict[str, tuple[float, dict]] = {}
_TTL_SECONDS = 60.0


async def fetch_json(url: str):
    now = time.time()
    cached = _cache.get(url)
    if cached and (now - cached[0]) < _TTL_SECONDS:
        return cached[1]

    # Try up to 3 attempts; if https fails and base is https, try http once
    last_exc = None
    urls_to_try = [url]
    if ERGAST_API.startswith("https://"):
        urls_to_try.append(url.replace("https://", "http://", 1))

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.get(urls_to_try[min(attempt, len(urls_to_try)-1)], headers={"Accept": "application/json"})
                res.raise_for_status()
                data = res.json()
                _cache[url] = (now, data)
                return data
        except httpx.HTTPError as exc:
            last_exc = exc
            await asyncio.sleep(0.5 * (attempt + 1))

    raise HTTPException(status_code=502, detail=f"Upstream error: {last_exc}")


@app.get("/api/drivers/current")
async def get_current_drivers():
    url = f"{ERGAST_API}/current/drivers.json"
    data = await fetch_json(url)
    drivers = (
        data.get("MRData", {})
        .get("DriverTable", {})
        .get("Drivers", [])
    )
    return {"drivers": drivers}


@app.get("/api/standings/current")
async def get_current_standings():
    url = f"{ERGAST_API}/current/driverStandings.json"
    data = await fetch_json(url)
    lists = (
        data.get("MRData", {})
        .get("StandingsTable", {})
        .get("StandingsLists", [])
    )
    standings = lists[0].get("DriverStandings", []) if lists else []
    return {"standings": standings}


@app.get("/api/results/current")
async def get_current_results():
    url = f"{ERGAST_API}/current/results.json?limit=2000"
    data = await fetch_json(url)
    races = (
        data.get("MRData", {})
        .get("RaceTable", {})
        .get("Races", [])
    )
    return {"races": races}


@app.get("/api/laps/{season}/{round}")
async def get_lap_times(season: int, round: int):
    url = f"{ERGAST_API}/{season}/{round}/laps.json?limit=2000"
    data = await fetch_json(url)
    try:
        laps = data["MRData"]["RaceTable"]["Races"][0].get("Laps", [])
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Laps not found")
    return {"laps": laps}


@app.get("/api/pitstops/{season}/{round}")
async def get_pitstops(season: int, round: int):
    url = f"{ERGAST_API}/{season}/{round}/pitstops.json?limit=2000"
    data = await fetch_json(url)
    try:
        stops = data["MRData"]["RaceTable"]["Races"][0].get("PitStops", [])
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Pitstops not found")
    return {"pitstops": stops}


@app.get("/api/status")
async def status():
    return {"ok": True}


