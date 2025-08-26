import fastf1
import fastf1.ergast
import pandas as pd
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from datetime import datetime

# --- Setup ------------------------------------------------------------------
app = FastAPI(title="Formula-Uno API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ----------------------------------------------------------
@app.get("/api/schedule/{season}")
async def get_schedule(season: int = Path(..., ge=1950, description="The year of the season")):
    try:
        # FastF1's main module is good for schedules
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        schedule_df = pd.DataFrame(schedule)
        schedule_df = schedule_df.rename(columns={"EventName": "raceName", "RoundNumber": "round"})
        # Convert to the format the frontend expects
        races_json_str = schedule_df.to_json(orient="records")
        return {"races": json.loads(races_json_str)}
    except Exception as e:
        # Handle future seasons gracefully
        if "No data for season" in str(e):
            return {"races": []}
        raise HTTPException(status_code=500, detail=f"Error getting schedule: {e}")

@app.get("/api/drivers/{season}")
async def get_drivers(season: int = Path(..., ge=1950)):
    try:
        # Use the Ergast module for consistency with other data points
        ergast = fastf1.ergast.Ergast()
        drivers = ergast.get_drivers(season=season).content
        return {"drivers": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting drivers: {e}")

@app.get("/api/standings/{season}")
async def get_standings(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        standings = ergast.get_driver_standings(season=season).content
        return {"standings": standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting standings: {e}")

@app.get("/api/results/{season}")
async def get_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        races = ergast.get_race_results(season=season).content
        return {"races": races}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting results: {e}")

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        races = ergast.get_qualifying_results(season=season).content
        return {"races": races}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting qualifying results: {e}")

@app.get("/api/status")
async def status():
    return {"ok": True}