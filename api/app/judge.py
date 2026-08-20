"""Process-level judge for the MVP's Python and C++ submissions."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class Verdict(StrEnum):
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded"
    RUNTIME_ERROR = "runtime_error"
    COMPILATION_ERROR = "compilation_error"


@dataclass(frozen=True)
class TestCase:
    input: str
    expected_output: str


@dataclass(frozen=True)
class JudgeResult:
    verdict: Verdict
    passed_tests: int
    total_tests: int
    execution_time_ms: int | None = None
    error_message: str | None = None


def _normalized_output(value: str) -> str:
    return " ".join(value.split())


def _limit_process(memory_limit_mb: int) -> None:
    if os.name != "posix":
        return

    import resource

    resource.setrlimit(resource.RLIMIT_AS, (memory_limit_mb * 1024 * 1024, memory_limit_mb * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (1, 1))


def _run_command(command: list[str], input_data: str, time_limit_ms: int, memory_limit_mb: int) -> subprocess.CompletedProcess[str]:
    options: dict[str, object] = {
        "input": input_data,
        "capture_output": True,
        "text": True,
        "timeout": time_limit_ms / 1000,
        "cwd": None,
        "check": False,
    }
    if os.name == "posix":
        options["preexec_fn"] = lambda: _limit_process(memory_limit_mb)

    return subprocess.run(
        command,
        **options,
    )


def judge_submission(
    code: str,
    language: str,
    test_cases: list[TestCase],
    time_limit_ms: int,
    memory_limit_mb: int,
) -> JudgeResult:
    """Compile, execute, and compare one submission against all test cases."""
    if not test_cases:
        raise ValueError("At least one test case is required")
    if language not in {"python", "cpp"}:
        raise ValueError("Only Python and C++ submissions are supported")

    with tempfile.TemporaryDirectory(prefix="koj-judge-") as directory:
        workdir = Path(directory)
        if language == "python":
            source = workdir / "main.py"
            source.write_text(code, encoding="utf-8")
            command = [sys.executable, str(source)]
        else:
            compiler = shutil.which("g++")
            if compiler is None:
                return JudgeResult(Verdict.COMPILATION_ERROR, 0, len(test_cases), error_message="g++ is not installed")
            source = workdir / "main.cpp"
            executable = workdir / ("main.exe" if os.name == "nt" else "main")
            source.write_text(code, encoding="utf-8")
            compile_result = subprocess.run(
                [compiler, str(source), "-O2", "-std=c++17", "-o", str(executable)],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=workdir,
                check=False,
            )
            if compile_result.returncode != 0:
                return JudgeResult(
                    Verdict.COMPILATION_ERROR,
                    0,
                    len(test_cases),
                    error_message=compile_result.stderr[-4000:],
                )
            command = [str(executable)]

        passed = 0
        total_time_ms = 0
        for test_case in test_cases:
            started_at = time.perf_counter()
            try:
                result = _run_command(command, test_case.input, time_limit_ms, memory_limit_mb)
            except subprocess.TimeoutExpired:
                return JudgeResult(Verdict.TIME_LIMIT_EXCEEDED, passed, len(test_cases), total_time_ms)
            except MemoryError:
                return JudgeResult(Verdict.MEMORY_LIMIT_EXCEEDED, passed, len(test_cases), total_time_ms)
            except OSError as error:
                return JudgeResult(Verdict.RUNTIME_ERROR, passed, len(test_cases), total_time_ms, str(error))

            total_time_ms += int((time.perf_counter() - started_at) * 1000)
            if result.returncode != 0:
                return JudgeResult(Verdict.RUNTIME_ERROR, passed, len(test_cases), total_time_ms, result.stderr[-4000:])
            if _normalized_output(result.stdout) != _normalized_output(test_case.expected_output):
                return JudgeResult(Verdict.WRONG_ANSWER, passed, len(test_cases), total_time_ms)
            passed += 1

        return JudgeResult(Verdict.ACCEPTED, passed, len(test_cases), total_time_ms)
