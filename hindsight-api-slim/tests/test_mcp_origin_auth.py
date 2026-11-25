"""MCP authentication happens in this process, before any MCP response.

A sessionless GET used to answer 200 without checking a credential. The open
default tenant extension is also not authentication: those requests are refused
unless local development opts in.
"""

import json
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest

from hindsight_api.api.mcp import MCPMiddleware, create_mcp_server
from hindsight_api.extensions.builtin.tenant import DefaultTenantExtension
from hindsight_api.models import RequestContext

from .test_mcp_tools import _tools


class _Memory:
    def __init__(self, extension: DefaultTenantExtension) -> None:
        self._tenant_extension = extension

    async def resolve_bank_alias(self, bank_id: str, request_context: RequestContext | None = None) -> str:
        del request_context
        return bank_id


async def _ok_app(scope, receive, send):
    del scope, receive
    await send({"type": "http.response.start", "status": 204, "headers": []})
    await send({"type": "http.response.body", "body": b""})


def _middleware(extension: DefaultTenantExtension) -> MCPMiddleware:
    return MCPMiddleware(
        app=_ok_app,
        memory=_Memory(extension),  # type: ignore[arg-type]
        multi_bank_app=_ok_app,
        single_bank_app=_ok_app,
    )


def _scope(method: str, token: str | None = None) -> dict:
    headers = [(b"content-type", b"application/json")]
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    return {"type": "http", "method": method, "path": "/mcp/synthetic-bank/", "headers": headers, "query_string": b""}


@dataclass
class _Reply:
    status: int
    body: bytes


async def _call(middleware: MCPMiddleware, scope: dict) -> _Reply:
    status = 0
    body = b""

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        nonlocal status, body
        if message["type"] == "http.response.start":
            status = message["status"]
        elif message["type"] == "http.response.body":
            body += message.get("body", b"")

    await middleware(scope, receive, send)
    return _Reply(status=status, body=body)


@pytest.fixture
def extension() -> DefaultTenantExtension:
    return DefaultTenantExtension({})


@pytest.mark.asyncio
async def test_get_probe_without_a_token_is_rejected(monkeypatch, extension):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", "synthetic-mcp-token")
    reply = await _call(_middleware(extension), _scope("GET"))

    assert reply.status == 401
    assert "Authorization header required" in json.loads(reply.body)["error"]


@pytest.mark.asyncio
async def test_get_probe_with_the_token_is_empty_ok(monkeypatch, extension):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", "synthetic-mcp-token")
    reply = await _call(_middleware(extension), _scope("GET", "synthetic-mcp-token"))

    assert reply.status == 200
    assert reply.body == b"{}"


@pytest.mark.asyncio
async def test_open_default_extension_is_refused(monkeypatch, extension, caplog):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", None)
    monkeypatch.delenv("HINDSIGHT_API_MCP_ALLOW_UNAUTHENTICATED", raising=False)
    monkeypatch.setattr("hindsight_api.api.mcp._missing_mcp_auth_logged", False)

    with caplog.at_level("ERROR"):
        reply = await _call(_middleware(extension), _scope("POST", "not-a-real-token"))

    assert reply.status == 401
    assert json.loads(reply.body)["error"] == "MCP authentication is not configured"
    assert "HINDSIGHT_API_MCP_AUTH_TOKEN" in caplog.text
    assert "not-a-real-token" not in caplog.text


@pytest.mark.asyncio
async def test_explicit_opt_out_allows_the_open_extension(monkeypatch, extension):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", None)
    monkeypatch.setenv("HINDSIGHT_API_MCP_ALLOW_UNAUTHENTICATED", "true")

    reply = await _call(_middleware(extension), _scope("POST"))

    assert reply.status == 204


@pytest.mark.asyncio
async def test_reflect_and_retain_run_only_after_origin_auth_and_stay_on_that_bank(monkeypatch, extension):
    """The new tools use the identity the origin check just established.

    A missing token never reaches them. A valid token runs them against the
    bank in the request path, with the pre-authentication flag set, and the
    operation lookup is still that bank's.
    """
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", "synthetic-mcp-token")
    memory = MagicMock()
    memory._tenant_extension = extension
    memory.resolve_bank_alias = AsyncMock(side_effect=lambda bank_id, **_: bank_id)
    memory.refuse_knowledge_bank = AsyncMock(return_value=None)
    memory.submit_async_reflect = AsyncMock(return_value={"operation_id": "op-reflect"})
    memory.submit_async_retain = AsyncMock(return_value={"operation_id": "op-retain"})

    async def status(bank_id, operation_id, *, request_context):
        assert request_context.mcp_authenticated is True
        assert request_context.api_key == "synthetic-mcp-token"
        if bank_id != "synthetic-bank":
            return {"operation_id": operation_id, "status": "not_found", "operation_type": "reflect"}
        if operation_id == "op-retain":
            return {
                "operation_id": operation_id,
                "status": "completed",
                "operation_type": "retain",
                "result_metadata": {"memory_ids": ["m1"]},
            }
        return {
            "operation_id": operation_id,
            "status": "completed",
            "operation_type": "reflect",
            "result_metadata": {"result": {"text": "the answer"}},
        }

    memory.get_operation_status = AsyncMock(side_effect=status)
    entered = False

    async def single_app(scope, receive, send):
        nonlocal entered
        del scope, receive
        entered = True
        tools = _tools(create_mcp_server(memory, multi_bank=False))
        reflect = await tools["reflect"].fn(query="what now", wait_seconds=0)
        retain = await tools["sync_retain"].fn(content="a stored fact", wait_seconds=0)
        fetched = await tools["get_reflect_result"].fn(operation_id="op-reflect", wait_seconds=0)
        body = json.dumps({"reflect": reflect, "retain": retain, "fetched": fetched}).encode()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": body})

    middleware = MCPMiddleware(
        app=_ok_app,
        memory=memory,  # type: ignore[arg-type]
        multi_bank_app=_ok_app,
        single_bank_app=single_app,
    )

    refused = await _call(middleware, _scope("POST"))
    assert refused.status == 401
    assert entered is False
    memory.submit_async_reflect.assert_not_called()
    memory.submit_async_retain.assert_not_called()

    reply = await _call(middleware, _scope("POST", "synthetic-mcp-token"))
    assert reply.status == 200
    payload = json.loads(reply.body)
    assert payload["reflect"]["text"] == "the answer"
    assert payload["fetched"]["text"] == "the answer"
    assert payload["retain"]["status"] == "completed"
    assert payload["retain"]["memory_ids"] == ["m1"]
    assert payload["retain"]["operation_id"] == "op-retain"

    reflect_call = memory.submit_async_reflect.call_args
    retain_call = memory.submit_async_retain.call_args
    assert reflect_call.kwargs["bank_id"] == "synthetic-bank"
    assert retain_call.kwargs["bank_id"] == "synthetic-bank"
    for call in (reflect_call, retain_call):
        context = call.kwargs["request_context"]
        assert context.mcp_authenticated is True
        assert context.api_key == "synthetic-mcp-token"
    looked_up = {call.args[0] for call in memory.get_operation_status.call_args_list}
    assert looked_up == {"synthetic-bank"}
