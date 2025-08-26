import fastf1
import fastf1.ergast
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import os
import json
from datetime import datetime

# --- Setup ------------------------------------------------------------------
app = FastAPI(title="Formula-Uno API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper for NumPy JSON Serialization ------------------------------------
def numpy_safe_converter(obj):
    """ Default JSON serializer for objects containing numpy types """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    elif isinstance(obj, pd.Timedelta):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

def create_json_response(content: dict) -> Response:
    """Creates a FastAPI Response object with NumPy-safe JSON content."""
    json_str = json.dumps(content, default=numpy_safe_converter)
    return Response(content=json_str, media_type="application/json")

# --- API Endpoints ----------------------------------------------------------
@app.get("/api/schedule/{season}")
async def get_schedule(season: int = Path(..., ge=1950, description="The year of the season")):
    try:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        schedule_df = pd.DataFrame(schedule)
        schedule_df = schedule_df.rename(columns={"EventName": "raceName", "RoundNumber": "round"})
        races_list = json.loads(schedule_df.to_json(orient="records"))
        return create_json_response({"races": races_list})
    except Exception as e:
        if "No data for season" in str(e):
            return create_json_response({"races": []})
        raise HTTPException(status_code=500, detail=f"Error getting schedule: {e}")

@app.get("/api/drivers/{season}")
async def get_drivers(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        drivers = ergast.get_drivers(season=season).content
        return create_json_response({"drivers": drivers})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting drivers: {e}")

@app.get("/api/standings/{season}")
async def get_standings(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        standings = ergast.get_driver_standings(season=season).content
        return create_json_response({"standings": standings})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting standings: {e}")

@app.get("/api/results/{season}")
async def get_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        races = ergast.get_race_results(season=season).content
        return create_json_response({"races": races})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting results: {e}")

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        races = ergast.get_qualifying_results(season=season).content
        return create_json_response({"races": races})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting qualifying results: {e}")

@app.get("/api/status")
async def status():
    return {"ok": True}