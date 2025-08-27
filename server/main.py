import fastf1
import fastf1.ergast
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
import os
import json
from datetime import datetime

# Initialize FastF1 cache (configurable via env FASTF1_CACHE_DIR)
CACHE_DIR = os.getenv("FASTF1_CACHE_DIR", os.path.join(os.getcwd(), ".fastf1-cache"))
os.makedirs(CACHE_DIR, exist_ok=True)
try:
    fastf1.Cache.enable_cache(CACHE_DIR)
except Exception:
    # If cache init fails, continue without cache; FastF1 can still fetch live
    pass

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


def to_records(data):
    """Convert pandas DataFrame/Series or FastF1/Ergast content to JSON records list."""
    try:
        if isinstance(data, pd.DataFrame):
            return json.loads(data.to_json(orient="records", date_format="iso"))
        # ErgastSimpleResponse acts like a DataFrame
        if hasattr(data, "to_json"):
            return json.loads(data.to_json(orient="records", date_format="iso"))
        # ErgastMultiResponse has .content which is a list of DataFrames
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
                        # ErgastResultFrame behaves like DataFrame
                        tmp = pd.DataFrame(item)
                        if "round" not in tmp.columns:
                            tmp["round"] = idx
                        frames.append(tmp)
                if frames:
                    df = pd.concat(frames, ignore_index=True)
                    return json.loads(df.to_json(orient="records", date_format="iso"))
            # Fallback to dumping the content directly
            return json.loads(json.dumps(content, default=numpy_safe_converter))
        # Fallback: already native
        return data
    except Exception:
        # Last resort: try numpy-safe json dumps and loads
        return json.loads(json.dumps(data, default=numpy_safe_converter))

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
        drivers_resp = ergast.get_driver_info(season=season)
        drivers = to_records(drivers_resp)
        return create_json_response({"drivers": drivers})
    except Exception as e:
        # Return empty list for seasons with no data
        if "No data" in str(e) or "404" in str(e):
            return create_json_response({"drivers": []})
        raise HTTPException(status_code=500, detail=f"Error getting drivers: {e}")

@app.get("/api/standings/{season}")
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

@app.get("/api/results/{season}")
async def get_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        # Build results per round to attach correct round numbers
        schedule_df = fastf1.ergast.Ergast().get_race_schedule(season=season)
        try:
            rounds = list(schedule_df["round"].astype(int).tolist())
        except Exception:
            rounds = []

        all_rows = []
        for rnd in rounds:
            try:
                resp = ergast.get_race_results(season=season, round=rnd)
                # resp may be Simple or Multi; normalize to list of DataFrames
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

@app.get("/api/qualifying/{season}")
async def get_qualifying_results(season: int = Path(..., ge=1950)):
    try:
        ergast = fastf1.ergast.Ergast()
        # Build qualifying per round to attach correct round numbers
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

@app.get("/api/status")
async def status():
    return {"ok": True}


@app.get("/api/session/{season}/{event}/{kind}")
async def get_session_info(
    season: int = Path(..., ge=1950),
    event: str = Path(..., description="Event name, e.g. Monza"),
    kind: str = Path(..., description="Session type, e.g. FP1, FP2, FP3, Q, R")
):
    """Load a FastF1 session and return minimal info to verify FastF1 works."""
    try:
        session = fastf1.get_session(season, event, kind)
        # Keep it light by default; toggle via query later if needed
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

# --- Static Files Mount -----------------------------------------------------
# This must be the last route, as it's a catch-all for serving the frontend
app.mount("/", StaticFiles(directory="static", html=True), name="static")
