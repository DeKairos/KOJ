"""Postgres connection helpers built on psycopg 3."""

from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass

import psycopg

from .config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SubmissionJob:
    submission_id: int
    code: str
    language: str
    time_limit_ms: int
    memory_limit_mb: int
    test_cases: list[tuple[str, str]]


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    """Yield a short-lived psycopg connection and always close it.

    The DSN comes from `settings.DATABASE_URL` and is handed to psycopg
    as a plain string. We `autocommit` so callers don't need to remember
    to commit short read-only queries, and we `close()` in `finally`
    so a failed query still returns the connection to the pool/closes
    the socket.
    """
    dsn: str = str(settings.DATABASE_URL)
    conn = psycopg.connect(dsn, autocommit=True)
    try:
        yield conn
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001 — best-effort close, never raise
            logger.exception("Failed to close psycopg connection cleanly")


def ping() -> bool:
    """Open a connection, run `SELECT 1`, and report success.

    Designed for `/health`: it MUST swallow all exceptions so a
    database outage degrades the endpoint instead of 500-ing.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                row = cur.fetchone()
                return row is not None and row[0] == 1
    except Exception:  # noqa: BLE001 — health probe must never raise
        logger.exception("Database ping failed")
        return False


def recover_running_submissions() -> None:
    """Return jobs interrupted by an API restart to the durable queue."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE submissions SET status = 'pending', started_at = NULL "
                "WHERE status = 'running'"
            )


def pending_submission_ids() -> list[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM submissions WHERE status = 'pending' ORDER BY submitted_at, id")
            return [row[0] for row in cur.fetchall()]


def claim_submission(submission_id: int) -> bool:
    """Atomically claim a pending submission for one worker."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE submissions SET status = 'running', started_at = now() "
                "WHERE id = %s AND status = 'pending' RETURNING id",
                (submission_id,),
            )
            return cur.fetchone() is not None


def get_submission_job(submission_id: int) -> SubmissionJob | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT s.id, s.code, s.language, p.time_limit_ms, p.memory_limit_mb "
                "FROM submissions s JOIN problems p ON p.id = s.problem_id WHERE s.id = %s",
                (submission_id,),
            )
            submission = cur.fetchone()
            if submission is None:
                return None
            cur.execute(
                "SELECT input, expected_output FROM problem_test_cases "
                "WHERE problem_id = (SELECT problem_id FROM submissions WHERE id = %s) "
                "ORDER BY position, id",
                (submission_id,),
            )
            return SubmissionJob(
                submission_id=submission[0],
                code=submission[1],
                language=submission[2],
                time_limit_ms=submission[3],
                memory_limit_mb=submission[4],
                test_cases=cur.fetchall(),
            )


def complete_submission(
    submission_id: int,
    verdict: str,
    passed_tests: int,
    total_tests: int,
    execution_time_ms: int | None,
    error_message: str | None,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE submissions SET status = %s, passed_tests = %s, total_tests = %s, "
                "execution_time_ms = %s, error_message = %s, completed_at = now() WHERE id = %s",
                (verdict, passed_tests, total_tests, execution_time_ms, error_message, submission_id),
            )


def fail_submission(submission_id: int, error_message: str) -> None:
    complete_submission(submission_id, "runtime_error", 0, 0, None, error_message)
