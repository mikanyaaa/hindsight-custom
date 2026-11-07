"""MCP keeps delegating to the configured tenant extension.

A deployment can authenticate MCP with its own TenantExtension, including one
fronted by an external proxy. These tests use a synthetic token only. They do
not start a database or call a live server.
"""

import json

import pytest

from hindsight_api.api.mcp import MCPMiddleware
from hindsight_api.extensions.tenant import AuthenticationError, Tenant, TenantContext, TenantExtension
from hindsight_api.models import RequestContext

SYNTHETIC_TOKEN = "synthetic-mcp-token"
PASSTHROUGH_HEADER = "x-user-assertion"
PASSTHROUGH_VALUE = "synthetic-assertion"


class RecordingTenant(TenantExtension):
    """Stand-in for an external tenant extension."""

    def __init__(self) -> None:
        super().__init__({})
        self.mcp_contexts: list[RequestContext] = []

    async def authenticate(self, context: RequestContext) -> TenantContext:
        raise AssertionError("MCP must call authenticate_mcp, not authenticate")

    async def list_tenants(self) -> list[Tenant]:
        return []

    async def authenticate_mcp(self, context: RequestContext) -> TenantContext:
        self.mcp_contexts.append(context)
        if context.api_key != SYNTHETIC_TOKEN:
            raise AuthenticationError("rejected synthetic token")
        return TenantContext(schema_name="synthetic_schema")


class _Memory:
    def __init__(self, extension: RecordingTenant) -> None:
        self._tenant_extension = extension

    async def resolve_bank_alias(self, bank_id: str, request_context: RequestContext | None = None) -> str:
        del request_context
        return bank_id


async def _ok_app(scope, receive, send):
    del scope, receive
    await send({"type": "http.response.start", "status": 204, "headers": []})
    await send({"type": "http.response.body", "body": b""})


def _middleware(extension: RecordingTenant) -> MCPMiddleware:
    memory = _Memory(extension)
    return MCPMiddleware(
        app=_ok_app,
        memory=memory,  # type: ignore[arg-type]
        multi_bank_app=_ok_app,
        single_bank_app=_ok_app,
    )


def _scope(token: str | None, assertion: str | None = None) -> dict:
    headers = [(b"content-type", b"application/json")]
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    if assertion is not None:
        headers.append((PASSTHROUGH_HEADER.encode(), assertion.encode()))
    return {"type": "http", "method": "POST", "path": "/mcp/synthetic-bank/", "headers": headers, "query_string": b""}


async def _call(middleware: MCPMiddleware, scope: dict) -> tuple[int, bytes]:
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
    return status, body


@pytest.mark.asyncio
async def test_mcp_delegates_bearer_token_to_tenant_extension(monkeypatch):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", None)
    extension = RecordingTenant()
    status, _body = await _call(_middleware(extension), _scope(SYNTHETIC_TOKEN))

    assert status == 204
    assert len(extension.mcp_contexts) == 1
    assert extension.mcp_contexts[0].api_key == SYNTHETIC_TOKEN


@pytest.mark.asyncio
async def test_mcp_rejects_a_token_the_tenant_extension_rejects(monkeypatch):
    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", None)
    extension = RecordingTenant()
    status, body = await _call(_middleware(extension), _scope("wrong-synthetic-token"))

    assert status == 401
    assert "rejected synthetic token" in json.loads(body)["error"]
    assert extension.mcp_contexts[0].api_key == "wrong-synthetic-token"


@pytest.mark.asyncio
async def test_mcp_forwards_an_opted_in_proxy_header(monkeypatch):
    from hindsight_api.config import clear_config_cache

    monkeypatch.setattr("hindsight_api.api.mcp.MCP_AUTH_TOKEN", None)
    monkeypatch.setenv("HINDSIGHT_API_EXTENSION_PASSTHROUGH_HEADERS", PASSTHROUGH_HEADER)
    clear_config_cache()
    try:
        extension = RecordingTenant()
        status, _body = await _call(_middleware(extension), _scope(SYNTHETIC_TOKEN, PASSTHROUGH_VALUE))
        assert status == 204
        assert extension.mcp_contexts[0].extra_headers[PASSTHROUGH_HEADER] == PASSTHROUGH_VALUE
    finally:
        clear_config_cache()
