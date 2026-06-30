from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from optimizer.solver import MAX_STOPS, MIN_STOPS, Stop, StopCountError, optimize

app = FastAPI(title="Fleet Route Optimizer", version="0.1.0")


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class StopInput(BaseModel):
    deliveryId: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OptimizeRequest(BaseModel):
    origin: Coordinate
    stops: list[StopInput]


class OptimizeResponse(BaseModel):
    sequence: list[str]
    groups: list[list[str]]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "optimizer"}


@app.post("/optimize", response_model=OptimizeResponse)
def optimize_route(req: OptimizeRequest) -> OptimizeResponse:
    stops = [Stop(delivery_id=s.deliveryId, lat=s.lat, lng=s.lng) for s in req.stops]
    try:
        result = optimize((req.origin.lat, req.origin.lng), stops)
    except StopCountError as exc:
        # The caller handles the >50 fallback; signal out-of-range explicitly.
        raise HTTPException(
            status_code=422,
            detail=f"stop count must be between {MIN_STOPS} and {MAX_STOPS}",
        ) from exc
    return OptimizeResponse(sequence=result["sequence"], groups=result["groups"])
