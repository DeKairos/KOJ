"""FastAPI entrypoint for the KOJ API service."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

from . import db
from .config import settings
from .worker import JudgeWorkerPool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("koj.api")

# Settings-driven CORS allow list. Next.js dev server is always permitted;
# the FastAPI service's own origin is included so the browser can call it
# during local development.
ALLOW_ORIGINS: list[str] = [
    "http://localhost:3000",
    settings.FASTAPI_URL,
]

app = FastAPI(
    title="KOJ API",
    version="0.1.0",
    description="Minimal FastAPI service backing the KOJ Next.js app.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JudgeRequest(BaseModel):
    submission_id: int = Field(gt=0)


worker_pool: JudgeWorkerPool | None = None


@app.on_event("startup")
def _on_startup() -> None:
    # Never log the DSN — only the bind address.
    logger.info("KOJ API starting on %s:%s", settings.FASTAPI_HOST, settings.FASTAPI_PORT)
    global worker_pool
    worker_pool = JudgeWorkerPool(settings.JUDGE_WORKERS)
    worker_pool.start()


@app.on_event("shutdown")
def _on_shutdown() -> None:
    if worker_pool is not None:
        worker_pool.stop()


@app.get("/")
def root() -> dict[str, str]:
    """Tiny index for sanity-checking the service is up."""
    return {"service": "koj-api", "docs": "/docs"}


@app.get("/health")
def health() -> JSONResponse:
    """Liveness + DB readiness.

    Always returns HTTP 200 so a transient DB blip doesn't take the
    service out of the load balancer — we surface the degradation in
    the payload instead.
    """
    db_ok: bool = db.ping()
    payload: dict[str, object] = {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
    }
    return JSONResponse(content=payload, status_code=200)


@app.post("/judge", status_code=202)
def judge(request: JudgeRequest, judge_key: str | None = Header(default=None, alias="x-judge-key")) -> dict[str, object]:
    if judge_key != settings.JUDGE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid judge dispatch key")
    if worker_pool is None:
        raise HTTPException(status_code=503, detail="Judge worker is not ready")
    worker_pool.enqueue(request.submission_id)
    return {"status": "queued", "submission_id": request.submission_id}
