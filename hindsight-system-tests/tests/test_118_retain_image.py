"""An agent retains an image over MCP, and text retain's temperature stays put.

retain_image describes the image with the image-retain model (here, the same
stub model the server uses for everything, because the image slot is unset and
falls back). That call omits temperature. Fact extraction then runs on the
description and still sends retain's default temperature. A non-image is
refused before any model call, and a retain-only allowlist does not expose the
tool.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from hindsight_system_tests.payloads import consolidation, extracted, fact
from hindsight_system_tests.steps import anchor_for

pytestmark = pytest.mark.asyncio

# 1x1 PNG. The bytes are the picture; the stub's description is what extraction sees.
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
DESCRIPTION = "A one-pixel red square."
FACT = "The image shows a one-pixel red square."


class _McpSession:
    """The JSON-RPC calls any MCP client makes, over streamable HTTP."""

    def __init__(self, http: httpx.AsyncClient, path: str) -> None:
        self._http = http
        self._path = path
        self._headers = {"Accept": "application/json, text/event-stream"}
        self._id = 0

    async def _post(self, method: str, params: dict[str, Any] | None = None, *, notify: bool = False) -> Any:
        body: dict[str, Any] = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if not notify:
            self._id += 1
            body["id"] = self._id
        response = await self._http.post(self._path, json=body, headers=self._headers)
        response.raise_for_status()
        if "mcp-session-id" in response.headers:
            self._headers["Mcp-Session-Id"] = response.headers["mcp-session-id"]
        if notify:
            return None
        if response.headers.get("content-type", "").startswith("text/event-stream"):
            data = [line[len("data:") :].strip() for line in response.text.splitlines() if line.startswith("data:")]
            message = json.loads(data[-1])
        else:
            message = response.json()
        assert "result" in message, message
        return message["result"]

    async def open(self) -> None:
        await self._post(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "system-test", "version": "1"},
            },
        )
        await self._post("notifications/initialized", notify=True)

    async def tools(self) -> set[str]:
        return {tool["name"] for tool in (await self._post("tools/list"))["tools"]}

    async def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        result = await self._post("tools/call", {"name": name, "arguments": arguments})
        text = result["content"][0]["text"]
        if result.get("isError"):
            return {"error": text}
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"result": parsed}


@pytest.fixture
async def session(hindsight_server, bank_id) -> AsyncIterator[_McpSession]:
    async with httpx.AsyncClient(base_url=hindsight_server.url, timeout=60) as http:
        client = _McpSession(http, f"/mcp/{bank_id}/")
        await client.open()
        yield client


def _by_anchor(llm, step: str):
    anchor = anchor_for(step)
    return [call for call in llm.calls if anchor in call.all_text]


async def test_a_bank_endpoint_lists_retain_image(session):
    tools = await session.tools()

    assert "retain_image" in tools
    assert "retain" in tools


async def test_a_non_image_is_refused_before_any_model_call(session, llm):
    before = len(llm.calls)

    result = await session.call(
        "retain_image",
        {"images": [{"media_type": "application/pdf", "data": PNG_B64}]},
    )

    assert "error" in result
    assert "image" in result["error"].lower()
    assert not any(anchor_for("describe_image") in call.all_text for call in llm.calls[before:])


async def test_an_image_is_described_then_retained_as_text(session, llm, client, bank_id, settled):
    llm.on_step("describe_image").returns_text(DESCRIPTION)
    llm.on_step("extract_facts", contains="one-pixel red square").returns(extracted(fact(FACT)))
    llm.on_step("consolidate").returns(consolidation())

    accepted = await session.call(
        "retain_image",
        {
            "images": [{"media_type": "image/png", "data": PNG_B64}],
            "caption": "Lab photo",
            "document_id": f"red-square-{uuid.uuid4().hex[:8]}",
        },
    )
    assert accepted["status"] == "accepted"
    assert accepted["operation_id"]

    await settled(bank_id)

    described = _by_anchor(llm, "describe_image")
    assert len(described) == 1
    assert described[0].temperature_sent is False
    assert "image_url" in json.dumps(described[0].messages)

    extracted_calls = _by_anchor(llm, "extract_facts")
    assert extracted_calls
    assert all(call.temperature_sent and call.temperature == 0.1 for call in extracted_calls)
    assert any("one-pixel red square" in call.user_text for call in extracted_calls)
    assert all("image_url" not in json.dumps(call.messages) for call in extracted_calls)

    response = await client.arecall(bank_id=bank_id, query="What does the image show?")
    # The stubbed pipeline makes this a pure function of the extracted fact.
    # Pin the rendered text, not a keyword that would also pass if ranking inverted.
    assert [result.text for result in response.results] == [FACT]
    assert response.results[0].type == "world"
    assert response.results[0].tags == []
    assert response.results[0].metadata == {}


async def test_a_retain_allowlist_does_not_include_retain_image(client, hindsight_server, bank_id):
    await client.aupdate_bank_config(bank_id, mcp_enabled_tools=["retain"])
    async with httpx.AsyncClient(base_url=hindsight_server.url, timeout=60) as http:
        agent = _McpSession(http, f"/mcp/{bank_id}/")
        await agent.open()
        retain_only = await agent.tools()

        await client.aupdate_bank_config(bank_id, mcp_enabled_tools=["retain_image"])
        image_only = await agent.tools()

    assert "retain" in retain_only and "retain_image" not in retain_only
    assert "retain_image" in image_only and "retain" not in image_only
