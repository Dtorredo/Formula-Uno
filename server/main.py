from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Any, Dict, List
import asyncio

# --------------------------------------------------------------------------
ERGAST_API = os.getenv("ERGAST_API", "https://api.jolpi.ca/ergast/f1").rstrip("/")
app = FastAPI(title="Formula-Uno API", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = httpx.AsyncClient(timeout=20.0)
cache: Dict[str, Any] = {}  # simple in-memory cache

# --------------------------------------------------------------------------
async def fetch_all_pages(base_url: str) -> List[Dict[str, Any]]:
    """
    Walk through every offset until no more data is returned.
    Works for results.json, qualifying.json, etc.
    """
    if base_url in cache:
        return cache[base_url]

    limit = 100            # Jolpi/Ergast max per page
    offset = 0
    all_items: List[Dict[str, Any]] = []

    while True:
        url = f"{ERGAST_API}/{base_url}?limit={limit}&offset={offset}"
        try:
            await asyncio.sleep(0.2)
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 502:
                raise HTTPException(status_code=502, detail="Ergast API is unavailable")
            raise HTTPException(status_code=exc.response.status_code, detail=f"Error from Ergast API: {exc}")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Upstream request error: {exc}")

        items = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        if not items:
            break
        all_items.extend(items)
        offset += limit

    cache[base_url] = all_items
    return all_items

# --------------------------------------------------------------------------
@app.get("/api/drivers/{season}")
async def get_drivers(season: str = Path(..., regex=r"^\d{4}$")):
    data = await fetch_all_pages(f"{season}/drivers.json")
    drivers = data[0].get("DriverTable", {}).get("Drivers", []) if data else []
    return {"drivers": drivers}

@app.get("/api/standings/{season}")
async def get_standings(season: str = Path(..., regex=r"^\d{4}$")):
    data = await fetch_all_pages(f"{season}/driverStandings.json")
    lists = data[0].get("StandingsTable", {}).get("StandingsLists", []) if data else []
    standings = lists[0].get("DriverStandings", []) if lists else []
    return {"standings": standings}

@app.get("/api/results/{season}")
async def get_results(season: str = Path(..., regex=r"^\d{4}$")):
    races = await fetch_all_pages(f"{season}/results.json")
    return {"races": races}

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: str = Path(..., regex=r"^\d{4}$")):
    races = await fetch_all_pages(f"{season}/qualifying.json")
    return {"races": races}

@app.get("/api/schedule/{season}")
async def get_schedule(season: str = Path(..., regex=r"^\d{4}$")):
    races = await fetch_all_pages(f"{season}.json")
    return {"races": races}

@app.get("/api/laps/{season}/{round_id}")
async def get_lap_times(season: int = Path(..., ge=1950), round_id: int = Path(..., ge=1)):
    races = await fetch_all_pages(f"{season}/{round_id}/laps.json")
    try:
        laps = races[0]["Laps"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Laps not found")
    return {"laps": laps}

@app.get("/api/pitstops/{season}/{round_id}")
async def get_pitstops(season: int = Path(..., ge=1950), round_id: int = Path(..., ge=1)):
    races = await fetch_all_pages(f"{season}/{round_id}/pitstops.json")
    try:
        stops = races[0]["PitStops"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Pitstops not found")
    return {"pitstops": stops}

@app.get("/api/status")
async def status():
    return {"ok": True}