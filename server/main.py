from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
import fastf1 as ff1
from fastf1.ergast import Ergast
import pandas as pd
from typing import Any, Dict, List

# --------------------------------------------------------------------------
app = FastAPI(title="Formula-Uno API", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enable cache
ff1.Cache.enable_cache('cache')

# --------------------------------------------------------------------------
@app.get("/api/drivers/{season}")
async def get_drivers(season: int = Path(..., ge=1950)):
    try:
        session = ff1.get_session(season, 1, 'R')
        session.load()
        drivers = session.results[['DriverNumber', 'BroadcastName', 'FullName', 'TeamName', 'TeamColor']].to_dict(orient='records')
        return {"drivers": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/standings/{season}")
async def get_standings(season: int = Path(..., ge=1950)):
    try:
        ergast = Ergast()
        standings = ergast.get_driver_standings(season).content
        return {"standings": standings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/results/{season}")
async def get_results(season: int = Path(..., ge=1950)):
    try:
        schedule = ff1.get_event_schedule(season)
        races = []
        for i in range(1, len(schedule) + 1):
            session = ff1.get_session(season, i, 'R')
            session.load()
            races.append(session.results.to_dict(orient='records'))
        return {"races": races}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: int = Path(..., ge=1950)):
    try:
        schedule = ff1.get_event_schedule(season)
        races = []
        for i in range(1, len(schedule) + 1):
            session = ff1.get_session(season, i, 'Q')
            session.load()
            races.append(session.results.to_dict(orient='records'))
        return {"races": races}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schedule/{season}")
async def get_schedule(season: int = Path(..., ge=1950)):
    try:
        schedule = ff1.get_event_schedule(season)
        return {"races": schedule.to_dict(orient='records')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status")
async def status():
    return {"ok": True}