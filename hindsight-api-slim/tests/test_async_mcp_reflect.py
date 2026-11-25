"""MCP reflect and sync_retain wait a short time, then hand back an operation id.

The clock is fake. A slow reflect is a status that stays pending until the fake
clock has moved 40 seconds, which is the case the ~30s MCP client used to drop.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from hindsight_api.config import DEFAULT_WORKER_MAX_SLOTS, WORKER_SLOT_TYPE_DEFAULTS, _parse_worker_slot_reservations
from hindsight_api.engine.memory_engine import MemoryEngine, _prepare_reflect_call
from hindsight_api.engine.operation_metadata import (
    MAX_RETAIN_RESULT_MEMORY_IDS,
    RetainExtractionErrors,
    RetainOutcomeAggregate,
    reflect_result_payload,
    retain_outcome_from_unit_ids,
)
from hindsight_api.engine.response_models import Budget, ReflectResult
from hindsight_api.mcp_tools import MCPToolsConfig, clamp_wait_seconds, register_mcp_tools

from .test_mcp_tools import _tools


def _server(memory, tools, *, include_bank_id):
    from fastmcp import FastMCP

    mcp = FastMCP("test")
    register_mcp_tools(
        mcp,
        memory,
        MCPToolsConfig(
            bank_id_resolver=lambda: "test-bank",
            include_bank_id_param=include_bank_id,
            tools=set(tools),
        ),
    )
    return mcp


def _data(result):
    import json

    return json.loads(result) if isinstance(result, str) else result


class _Clock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def monotonic(self) -> float:
        return self.now


def _install_clock(monkeypatch):
    import hindsight_api.mcp_tools as mcp_tools

    clock = _Clock()

    async def _sleep(seconds):
        clock.now += seconds

    monkeypatch.setattr(mcp_tools.time, "monotonic", clock.monotonic)
    monkeypatch.setattr(mcp_tools.asyncio, "sleep", _sleep)
    return clock


class _Progress:
    def __init__(self, token):
        self.request_context = SimpleNamespace(meta=SimpleNamespace(progressToken=token))
        self.calls: list[tuple[float, float, str]] = []

    async def report_progress(self, progress, total=None, message=None):
        self.calls.append((progress, total, message))


def _memory_with_status(status_for):
    memory = MagicMock()
    memory.resolve_bank_alias = AsyncMock(side_effect=lambda bank_id, **_: bank_id)
    # Memory tools refuse a knowledge bank before they run. This mock is a memory bank.
    memory.refuse_knowledge_bank = AsyncMock(return_value=None)
    memory.get_operation_status = AsyncMock(side_effect=status_for)
    memory.submit_async_reflect = AsyncMock(return_value={"operation_id": "op-reflect"})
    memory.submit_async_retain = AsyncMock(return_value={"operation_id": "op-retain"})
    memory.cancel_operation = AsyncMock(return_value={"status": "cancelled", "operation_id": "op-reflect"})
    return memory


@pytest.mark.parametrize("include_bank_id", [True, False])
async def test_fast_reflect_returns_the_stored_answer(include_bank_id):
    answer = {
        "text": "the answer",
        "structured_output": {"choice": "a"},
        "usage": {"input_tokens": 3, "output_tokens": 1, "total_tokens": 4},
    }

    async def status(bank_id, operation_id, **kwargs):
        return {
            "status": "completed",
            "operation_type": "reflect",
            "operation_id": operation_id,
            "result_metadata": {"result": dict(answer)},
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect"}, include_bank_id=include_bank_id)
    data = _data(await _tools(mcp)["reflect"].fn(query="what now"))
    assert data == answer
    assert "status" not in data


async def test_slow_reflect_returns_pending_then_the_answer(monkeypatch):
    clock = _install_clock(monkeypatch)
    started = clock.now

    async def status(bank_id, operation_id, **kwargs):
        if clock.now < started + 40:
            return {"status": "pending", "operation_type": "reflect", "operation_id": operation_id}
        return {
            "status": "completed",
            "operation_type": "reflect",
            "operation_id": operation_id,
            "result_metadata": {"result": {"text": "finished later"}},
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect", "get_reflect_result"}, include_bank_id=False)
    tools = _tools(mcp)
    pending = await tools["reflect"].fn(query="slow", wait_seconds=20)
    assert pending == {
        "status": "pending",
        "operation_id": "op-reflect",
        "hint": "call get_reflect_result with this operation_id",
    }
    assert clock.now == started + 20

    data = await tools["get_reflect_result"].fn(operation_id="op-reflect", wait_seconds=20)
    assert data == {"text": "finished later"}


async def test_wait_zero_checks_once_and_does_not_sleep(monkeypatch):
    clock = _install_clock(monkeypatch)
    slept = {"calls": 0}
    import hindsight_api.mcp_tools as mcp_tools

    async def _sleep(seconds):
        slept["calls"] += 1
        clock.now += seconds

    monkeypatch.setattr(mcp_tools.asyncio, "sleep", _sleep)

    async def status(bank_id, operation_id, **kwargs):
        return {"status": "processing", "operation_type": "reflect", "operation_id": operation_id}

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect"}, include_bank_id=False)
    result = await _tools(mcp)["reflect"].fn(query="q", wait_seconds=0)
    assert result["status"] == "pending"
    assert slept["calls"] == 0


async def test_progress_is_reported_about_every_ten_seconds_when_a_token_is_present(monkeypatch):
    _install_clock(monkeypatch)
    import hindsight_api.mcp_tools as mcp_tools

    progress = _Progress("tok")
    monkeypatch.setattr(mcp_tools, "_current_mcp_context", lambda: progress)

    async def status(bank_id, operation_id, **kwargs):
        return {"status": "processing", "operation_type": "reflect", "operation_id": operation_id}

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect"}, include_bank_id=False)
    result = await _tools(mcp)["reflect"].fn(query="q", wait_seconds=25)
    assert result["status"] == "pending"
    assert [round(call[0]) for call in progress.calls] == [10, 20]
    assert all(call[2] == "reflect still running" for call in progress.calls)


async def test_progress_is_not_reported_without_a_token(monkeypatch):
    _install_clock(monkeypatch)
    import hindsight_api.mcp_tools as mcp_tools

    progress = _Progress(None)
    monkeypatch.setattr(mcp_tools, "_current_mcp_context", lambda: progress)

    async def status(bank_id, operation_id, **kwargs):
        return {"status": "processing", "operation_type": "reflect", "operation_id": operation_id}

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect"}, include_bank_id=False)
    await _tools(mcp)["reflect"].fn(query="q", wait_seconds=25)
    assert progress.calls == []


def test_wait_seconds_is_clamped_rather_than_rejected():
    assert clamp_wait_seconds(-5) == 0
    assert clamp_wait_seconds(0) == 0
    assert clamp_wait_seconds(20) == 20
    assert clamp_wait_seconds(25) == 25
    assert clamp_wait_seconds(100) == 25


async def test_a_hundred_second_wait_stops_at_the_clamp(monkeypatch):
    clock = _install_clock(monkeypatch)
    started = clock.now

    async def status(bank_id, operation_id, **kwargs):
        return {"status": "processing", "operation_type": "reflect", "operation_id": operation_id}

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect"}, include_bank_id=False)
    result = await _tools(mcp)["reflect"].fn(query="q", wait_seconds=100)
    assert result["status"] == "pending"
    assert clock.now == started + 25


async def test_cancelled_reflect_is_an_error_and_cancel_operation_reaches_the_engine():
    async def status(bank_id, operation_id, **kwargs):
        return {
            "status": "cancelled",
            "operation_type": "reflect",
            "operation_id": operation_id,
            "error_message": "stopped",
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"reflect", "get_reflect_result", "cancel_operation"}, include_bank_id=False)
    tools = _tools(mcp)
    reflected = await tools["reflect"].fn(query="q", wait_seconds=0)
    assert reflected["status"] == "error"
    assert "stopped" in reflected["error"]
    assert reflected["text"] == ""

    polled = await tools["get_reflect_result"].fn(operation_id="op-reflect", wait_seconds=0)
    assert polled["status"] == "error"

    await tools["cancel_operation"].fn(operation_id="op-reflect")
    memory.cancel_operation.assert_awaited()
    assert memory.cancel_operation.await_args.args[1] == "op-reflect"


async def test_a_reflect_for_another_bank_is_rejected():
    seen: list[str] = []

    async def status(bank_id, operation_id, **kwargs):
        seen.append(bank_id)
        return {
            "status": "not_found",
            "operation_type": None,
            "operation_id": operation_id,
            "result_metadata": {"result": {"text": "someone else's answer"}},
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"get_reflect_result"}, include_bank_id=False)
    result = await _tools(mcp)["get_reflect_result"].fn(operation_id="op-other")
    assert result["status"] == "error"
    assert "not found" in result["error"]
    assert "someone else's answer" not in str(result)
    assert seen == ["test-bank"]


async def test_a_failed_reflect_surfaces_as_an_error():
    async def status(bank_id, operation_id, **kwargs):
        return {
            "status": "failed",
            "operation_type": "reflect",
            "operation_id": operation_id,
            "error_message": "provider unavailable",
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"get_reflect_result"}, include_bank_id=True)
    import json

    result = json.loads(await _tools(mcp)["get_reflect_result"].fn(operation_id="op-reflect", bank_id="test-bank"))
    assert result["status"] == "error"
    assert result["error"] == "provider unavailable"
    assert result["text"] == ""


async def test_a_retain_operation_is_not_returned_as_a_reflect():
    async def status(bank_id, operation_id, **kwargs):
        return {
            "status": "completed",
            "operation_type": "batch_retain",
            "operation_id": operation_id,
            "result_metadata": {"result": {"text": "not a reflect"}},
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"get_reflect_result"}, include_bank_id=False)
    result = await _tools(mcp)["get_reflect_result"].fn(operation_id="op-retain")
    assert result["status"] == "error"
    assert "not a reflect" in result["error"]


async def test_slow_sync_retain_returns_the_retain_operation_id(monkeypatch):
    _install_clock(monkeypatch)

    async def status(bank_id, operation_id, **kwargs):
        return {"status": "processing", "operation_type": "batch_retain", "operation_id": operation_id}

    memory = _memory_with_status(status)
    mcp = _server(memory, {"sync_retain"}, include_bank_id=False)
    result = await _tools(mcp)["sync_retain"].fn(content="remember this", wait_seconds=20)
    assert result == {
        "status": "pending",
        "operation_id": "op-retain",
        "hint": "call get_operation with this operation_id",
    }


async def test_fast_sync_retain_returns_memory_ids_and_the_operation_id():
    async def status(bank_id, operation_id, **kwargs):
        return {
            "status": "completed",
            "operation_type": "batch_retain",
            "operation_id": operation_id,
            "result_metadata": {"memory_ids": ["m1", "m2"], "unit_ids_count": 2},
        }

    memory = _memory_with_status(status)
    mcp = _server(memory, {"sync_retain"}, include_bank_id=False)
    result = await _tools(mcp)["sync_retain"].fn(content="remember this")
    assert result["status"] == "completed"
    assert result["memory_ids"] == ["m1", "m2"]
    assert result["operation_id"] == "op-retain"
    assert result["message"] == "Memory stored successfully"


def test_reflect_payload_omits_trace_and_based_on_unless_asked():
    data = {
        "text": "answer",
        "based_on": {"world": []},
        "tool_trace": [{"tool": "recall"}],
        "llm_trace": [{"model": "test"}],
        "directives_applied": [{"id": "d1"}],
        "usage": {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2},
    }
    plain = reflect_result_payload(data, include_based_on=False, include_trace=False)
    assert plain.keys() == {"text", "usage"}
    full = reflect_result_payload(data, include_based_on=True, include_trace=True)
    assert full.keys() == data.keys()


def test_prepare_reflect_call_coerces_budget_and_keeps_flags_off_the_engine_kwargs():
    prepared = _prepare_reflect_call(
        {
            "query": "q",
            "budget": "mid",
            "include_based_on": True,
            "include_trace": False,
            "_tenant_id": "tenant",
            "operation_id": "op",
            "created_after": "2024-01-02T03:04:05+00:00",
            "created_before": "2024-02-01T00:00:00Z",
        }
    )
    assert prepared.kwargs["budget"] is Budget.MID
    assert prepared.kwargs["query"] == "q"
    assert prepared.kwargs["created_after"] == datetime(2024, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    assert prepared.kwargs["created_before"] == datetime(2024, 2, 1, tzinfo=timezone.utc)
    assert "include_based_on" not in prepared.kwargs
    assert "_tenant_id" not in prepared.kwargs
    assert prepared.include_based_on is True
    assert prepared.include_trace is False


def test_reflect_reserves_a_worker_slot(monkeypatch):
    assert WORKER_SLOT_TYPE_DEFAULTS["reflect"] >= 1
    assert sum(WORKER_SLOT_TYPE_DEFAULTS.values()) <= DEFAULT_WORKER_MAX_SLOTS
    monkeypatch.delenv("HINDSIGHT_API_WORKER_REFLECT_RESERVED_SLOTS", raising=False)
    monkeypatch.delenv("HINDSIGHT_API_WORKER_REFLECT_MAX_SLOTS", raising=False)
    assert _parse_worker_slot_reservations()["reflect"] == 1


def test_retain_outcome_records_memory_ids_until_the_cap():
    outcome = retain_outcome_from_unit_ids([["a", "b"], ["c"]], RetainExtractionErrors())
    assert outcome.to_dict()["memory_ids"] == ["a", "b", "c"]
    assert "memory_ids_truncated" not in outcome.to_dict()

    too_many = [[str(i) for i in range(MAX_RETAIN_RESULT_MEMORY_IDS + 1)]]
    truncated = retain_outcome_from_unit_ids(too_many, RetainExtractionErrors())
    assert "memory_ids" not in truncated.to_dict()
    assert truncated.to_dict()["memory_ids_truncated"] is True


def test_parent_retain_drops_memory_ids_when_a_child_did_not_record_them():
    aggregate = RetainOutcomeAggregate()
    aggregate.add_metadata({"unit_ids_count": 1, "memory_ids": ["a"]})
    aggregate.add_metadata({"unit_ids_count": 1})
    stored = aggregate.to_outcome_metadata().to_dict()
    assert stored["unit_ids_count"] == 2
    assert "memory_ids" not in stored


@pytest.mark.asyncio
async def test_execute_task_routes_reflect():
    engine = MemoryEngine.__new__(MemoryEngine)
    engine._audit_logger = None
    engine._handle_reflect = AsyncMock()
    task = {"type": "reflect", "bank_id": "bank", "query": "q"}
    await engine._execute_task(task)
    engine._handle_reflect.assert_awaited_once()
    assert engine._handle_reflect.await_args.args[0]["type"] == "reflect"


@pytest.mark.asyncio
async def test_handle_reflect_stores_the_public_answer_and_coerces_budget():
    engine = MemoryEngine.__new__(MemoryEngine)
    engine.reflect_async = AsyncMock(return_value=ReflectResult(text="hi", based_on={"world": [{"id": "fact-1"}]}))
    engine._write_reflect_result = AsyncMock()
    engine._check_op_alive = AsyncMock(return_value=True)
    await engine._handle_reflect(
        {
            "type": "reflect",
            "bank_id": "bank",
            "operation_id": "op-1",
            "query": "q",
            "budget": "high",
            "include_based_on": False,
            "include_trace": False,
        }
    )
    kwargs = engine.reflect_async.await_args.kwargs
    assert kwargs["budget"] is Budget.HIGH
    assert kwargs["query"] == "q"
    assert "include_based_on" not in kwargs
    payload = engine._write_reflect_result.await_args.args[2]
    assert payload["text"] == "hi"
    assert "based_on" not in payload
    assert "tool_trace" not in payload
    assert "llm_trace" not in payload


@pytest.mark.asyncio
async def test_handle_reflect_does_not_store_a_result_when_cancelled():
    from hindsight_api.cancellation import OperationCancelledError

    engine = MemoryEngine.__new__(MemoryEngine)
    engine.reflect_async = AsyncMock(side_effect=OperationCancelledError("operation cancelled"))
    engine._write_reflect_result = AsyncMock()
    engine._check_op_alive = AsyncMock(return_value=False)
    await engine._handle_reflect({"type": "reflect", "bank_id": "bank", "operation_id": "op-1", "query": "q"})
    engine._write_reflect_result.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_reflect_propagates_a_failure():
    engine = MemoryEngine.__new__(MemoryEngine)
    engine.reflect_async = AsyncMock(side_effect=RuntimeError("llm down"))
    engine._write_reflect_result = AsyncMock()
    engine._check_op_alive = AsyncMock(return_value=True)
    with pytest.raises(RuntimeError, match="llm down"):
        await engine._handle_reflect({"type": "reflect", "bank_id": "bank", "operation_id": "op-1", "query": "q"})
    engine._write_reflect_result.assert_not_awaited()
