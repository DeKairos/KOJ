"""Durable submission queue backed by Postgres and processed by threads."""

from __future__ import annotations

import logging
from queue import Empty, Queue
from threading import Event, Thread

from . import db
from .judge import TestCase, judge_submission

logger = logging.getLogger("koj.worker")


class JudgeWorkerPool:
    def __init__(self, worker_count: int) -> None:
        self._queue: Queue[int] = Queue()
        self._stop = Event()
        self._threads = [Thread(target=self._run, name=f"koj-judge-{index}", daemon=True) for index in range(worker_count)]

    def start(self) -> None:
        db.recover_running_submissions()
        for submission_id in db.pending_submission_ids():
            self.enqueue(submission_id)
        for thread in self._threads:
            thread.start()
        logger.info("Started %s judge worker(s)", len(self._threads))

    def stop(self) -> None:
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=5)

    def enqueue(self, submission_id: int) -> None:
        self._queue.put_nowait(submission_id)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                submission_id = self._queue.get(timeout=0.5)
            except Empty:
                continue
            try:
                self._process(submission_id)
            finally:
                self._queue.task_done()

    def _process(self, submission_id: int) -> None:
        if not db.claim_submission(submission_id):
            return
        try:
            job = db.get_submission_job(submission_id)
            if job is None or not job.test_cases:
                raise ValueError("Submission has no executable test cases")
            result = judge_submission(
                code=job.code,
                language=job.language,
                test_cases=[TestCase(input_data, expected_output) for input_data, expected_output in job.test_cases],
                time_limit_ms=job.time_limit_ms,
                memory_limit_mb=job.memory_limit_mb,
            )
            db.complete_submission(
                submission_id,
                result.verdict.value,
                result.passed_tests,
                result.total_tests,
                result.execution_time_ms,
                result.error_message,
            )
        except Exception as error:  # noqa: BLE001 — worker must record failures and continue
            logger.exception("Submission %s failed in judge worker", submission_id)
            db.fail_submission(submission_id, str(error))
