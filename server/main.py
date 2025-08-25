from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Any, Dict

# Use the new Ergast API URL
ERGAST_API = os.getenv("ERGAST_API", "https://api.jolpi.ca/ergast/f1")

app = FastAPI(title="Formula-Uno API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared httpx client
client = httpx.AsyncClient(timeout=20.0)

async def fetch_from_ergast(url: str) -> Dict[str, Any]:
    """Fetches JSON data from the Ergast API, with error handling."""
    try:
        res = await client.get(f"{ERGAST_API}/{url}", headers={"Accept": "application/json"})
        res.raise_for_status()
        return res.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error from Ergast API: {exc}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream request error: {exc}")

@app.get("/api/drivers/{season}")
async def get_drivers(season: str):
    data = await fetch_from_ergast(f"{season}/drivers.json")
    drivers = data.get("MRData", {}).get("DriverTable", {}).get("Drivers", [])
    return {"drivers": drivers}

@app.get("/api/standings/{season}")
async def get_standings(season: str):
    data = await fetch_from_ergast(f"{season}/driverStandings.json")
    lists = data.get("MRData", {}).get("StandingsTable", {}).get("StandingsLists", [])
    standings = lists[0].get("DriverStandings", []) if lists else []
    return {"standings": standings}

@app.get("/api/results/{season}")
async def get_results(season: str):
    data = await fetch_from_ergast(f"{season}/results.json?limit=2000")
    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    return {"races": races}

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: str):
    data = await fetch_from_ergast(f"{season}/qualifying.json?limit=2000")
    races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    return {"races": races}

@app.get("/api/laps/{season}/{round_id}")
async def get_lap_times(season: int, round_id: int):
    data = await fetch_from_ergast(f"{season}/{round_id}/laps.json?limit=2000")
    try:
        laps = data["MRData"]["RaceTable"]["Races"][0].get("Laps", [])
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Laps not found")
    return {"laps": laps}

@app.get("/api/pitstops/{season}/{round_id}")
async def get_pitstops(season: int, round_id: int):
    data = await fetch_from_ergast(f"{season}/{round_id}/pitstops.json?limit=2000")
    try:
        stops = data["MRData"]["RaceTable"]["Races"][0].get("PitStops", [])
    except (KeyError, IndexError):
        raise HTTPException(status_code=404, detail="Pitstops not found")
    return {"pitstops": stops}

@app.get("/api/status")
async def status():
    return {"ok": True}
