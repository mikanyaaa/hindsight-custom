"""MCP authentication happens in this process, before any MCP response.

A sessionless GET used to answer 200 without checking a credential. The open
default tenant extension is also not authentication: those requests are refused
unless local development opts in.
"""

import json
from dataclasses import dataclass

import pytest

from hindsight_api.api.mcp import MCPMiddleware
from hindsight_api.extensions.builtin.tenant import DefaultTenantExtension
from hindsight_api.models import RequestContext


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
