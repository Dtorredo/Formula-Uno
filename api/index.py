import fastf1
import fastf1.ergast
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Path, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import os
import json
import redis

# --- Cache Configuration ----------------------------------------------------
# This is the new cache setup for Vercel.
# It uses Upstash Redis for persistent caching in a serverless environment.
#
# IMPORTANT: You must create a free Redis database at https://upstash.com/
# and set the following environment variables in your Vercel project settings:
#
# UPSTASH_REDIS_REST_URL: The REST URL of your Upstash database.
# UPSTASH_REDIS_REST_TOKEN: The access token for your Upstash database.
#
# The `fastf1.Cache.enable_cache` function will automatically detect these
# environment variables and configure the Redis cache.

try:
    # The 'redis' extra for fastf1 is needed: pip install "fastf1[redis]"
    # This will automatically use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
    # if they are set in the environment.
    fastf1.Cache.enable_cache()
    # The cache function does not raise an error if connection fails,
    # so we add a manual check to know if the cache is actually working.
    if fastf1.Cache.instance and fastf1.Cache.instance.is_initialized:
         print("FastF1 cache enabled successfully.")
    else:
         print("FastF1 cache could not be initialized. Check Redis connection.")
except Exception as e:
    # If cache init fails, log the error but continue without cache.
    # The app will still work but will be slower.
    print(f"An error occurred during cache setup: {e}")
    pass

# --- Setup ------------------------------------------------------------------
app = FastAPI(title="Formula-Uno API", version="2.0.0")
router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins
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


def to_records(data):
    """Convert pandas DataFrame/Series or FastF1/Ergast content to JSON records list."""
    try:
        if isinstance(data, pd.DataFrame):
            return json.loads(data.to_json(orient="records", date_format="iso"))
        if hasattr(data, "to_json"):
            return json.loads(data.to_json(orient="records", date_format="iso"))
        if hasattr(data, "content"):
            content = getattr(data, "content")
            if isinstance(content, list):
                frames = []
                for idx, item in enumerate(content, start=1):
                    if isinstance(item, pd.DataFrame):
                        df_item = item.copy()
                        if "round" not in df_item.columns:
                            df_item["round"] = idx
                        frames.append(df_item)
                    elif hasattr(item, "to_json"):
                        tmp = pd.DataFrame(item)
                        if "round" not in tmp.columns:
                            tmp["round"] = idx
                        frames.append(tmp)
                if frames:
                    df = pd.concat(frames, ignore_index=True)
                    return json.loads(df.to_json(orient="records", date_format="iso"))
            return json.loads(json.dumps(content, default=numpy_safe_converter))
        return data
    except Exception:
        return json.loads(json.dumps(data, default=numpy_safe_converter))

# --- API Endpoints ----------------------------------------------------------
# Note: All endpoints are prefixed with /api/ by Vercel's routing.
# The paths defined here are relative to that.
# e.g., @app.get("/schedule/{season}") becomes /api/schedule/{season}

@router.get("/schedule/{season}")
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

@router.get("/drivers/{season}")
async def get_drivers(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        drivers_resp = ergast.get_driver_info(season=season)
        drivers = to_records(drivers_resp)
        return create_json_response({"drivers": drivers})
    except Exception as e:
        if "No data" in str(e) or "404" in str(e):
            return create_json_response({"drivers": []})
        raise HTTPException(status_code=500, detail=f"Error getting drivers: {e}")

@router.get("/standings/{season}")
async def get_standings(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        standings_resp = ergast.get_driver_standings(season=season)
        standings = to_records(standings_resp)
        return create_json_response({"standings": standings})
    except Exception as e:
        if "No data" in str(e) or "404" in str(e):
            return create_json_response({"standings": []})
        raise HTTPException(status_code=500, detail=f"Error getting standings: {e}")

@router.get("/results/{season}")
async def get_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        schedule_df = fastf1.ergast.Ergast().get_race_schedule(season=season)
        try:
            rounds = list(schedule_df["round"].astype(int).tolist())
        except Exception:
            rounds = []

        all_rows = []
        for rnd in rounds:
            try:
                resp = ergast.get_race_results(season=season, round=rnd)
                frames = []
                if hasattr(resp, "content") and isinstance(resp.content, list):
                    frames = resp.content
                else:
                    frames = [resp]
                for fr in frames:
                    df = fr if isinstance(fr, pd.DataFrame) else pd.DataFrame(fr)
                    if not df.empty:
                        df = df.copy()
                        df["round"] = rnd
                        all_rows.append(df)
            except Exception:
                continue
        if all_rows:
            out = json.loads(pd.concat(all_rows, ignore_index=True).to_json(orient="records", date_format="iso"))
        else:
            out = []
        return create_json_response({"races": out})
    except Exception as e:
        if "No data" in str(e) or "404" in str(e):
            return create_json_response({"races": []})
        raise HTTPException(status_code=500, detail=f"Error getting results: {e}")

@router.get("/qualifying/{season}")
async def get_qualifying_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        schedule_df = fastf1.ergast.Ergast().get_race_schedule(season=season)
        try:
            rounds = list(schedule_df["round"].astype(int).tolist())
        except Exception:
            rounds = []

        all_rows = []
        for rnd in rounds:
            try:
                resp = ergast.get_qualifying_results(season=season, round=rnd)
                frames = []
                if hasattr(resp, "content") and isinstance(resp.content, list):
                    frames = resp.content
                else:
                    frames = [resp]
                for fr in frames:
                    df = fr if isinstance(fr, pd.DataFrame) else pd.DataFrame(fr)
                    if not df.empty:
                        df = df.copy()
                        df["round"] = rnd
                        all_rows.append(df)
            except Exception:
                continue
        if all_rows:
            out = json.loads(pd.concat(all_rows, ignore_index=True).to_json(orient="records", date_format="iso"))
        else:
            out = []
        return create_json_response({"races": out})
    except Exception as e:
        if "No data" in str(e) or "404" in str(e):
            return create_json_response({"races": []})
        raise HTTPException(status_code=500, detail=f"Error getting qualifying results: {e}")

@router.get("/status")
async def status():
    return {"ok": True, "cache_enabled": fastf1.Cache.instance.is_initialized if fastf1.Cache.instance else False}


@router.get("/session/{season}/{event}/{kind}")
async def get_session_info(
    season: int = Path(..., ge=1950),
    event: str = Path(..., description="Event name, e.g. Monza"),
    kind: str = Path(..., description="Session type, e.g. FP1, FP2, FP3, Q, R")
):
    """Load a FastF1 session and return minimal info to verify FastF1 works."""
    try:
        session = fastf1.get_session(season, event, kind)
        session.load(telemetry=False, laps=True, weather=False)

        fastest = None
        try:
            fastest_lap = session.laps.pick_fastest()
            fastest = {
                "driver": str(fastest_lap.get("Driver", None)),
                "lap_time": str(fastest_lap.get("LapTime", None)),
            }
        except Exception:
            fastest = None

        info = {
            "event_name": session.event.EventName if hasattr(session, "event") else event,
            "session_name": session.name if hasattr(session, "name") else kind,
            "date": str(session.event.EventDate) if hasattr(session, "event") else None,
            "laps_count": int(len(session.laps)) if hasattr(session, "laps") else 0,
            "fastest_lap": fastest,
        }

        return create_json_response(info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading session: {e}")

app.include_router(router)
