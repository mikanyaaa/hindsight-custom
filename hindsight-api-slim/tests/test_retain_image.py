"""retain_image describes with its own model. Normal retain keeps its temperature.

The vision slot used to be the only way to hand an image to a model, and that
path sends ``llm_temperature_retain`` even after it swaps in the vision model.
A model that rejects temperature (Claude Haiku) cannot sit there unless retain's
temperature is omitted too, which would also change text retain. These tests
pin the split: the description call has its own temperature, and fact extraction
of an ordinary attachment still receives the retain temperature.
"""

from __future__ import annotations

import base64
import json
from dataclasses import replace
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from hindsight_api.config import HindsightConfig, clear_config_cache, get_config
from hindsight_api.engine.response_models import LLMCallResult, TokenUsage
from hindsight_api.engine.retain.attachment_content import (
    LoadedAttachment,
    attachment_placeholder,
    compute_attachment_hash,
    short_attachment_id,
)
from hindsight_api.engine.retain.fact_extraction import _extract_facts_from_chunk
from hindsight_api.image_retain import (
    DESCRIBE_PROMPT,
    MARKER,
    ImageRetainRejected,
    PreparedImage,
    clear_image_llm_cache,
    describe_images,
    expand_queued_images,
    image_llm,
    resolve_image_retain_model,
)
from hindsight_api.webhooks.url_guard import parse_allowlist

PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
PNG = base64.b64decode(PNG_B64)
ATTACHMENT_ID = short_attachment_id(compute_attachment_hash(PNG))

_IMAGE_ENV = (
    "HINDSIGHT_API_IMAGE_RETAIN_LLM_PROVIDER",
    "HINDSIGHT_API_IMAGE_RETAIN_LLM_MODEL",
    "HINDSIGHT_API_IMAGE_RETAIN_LLM_API_KEY",
    "HINDSIGHT_API_IMAGE_RETAIN_LLM_BASE_URL",
    "HINDSIGHT_API_IMAGE_RETAIN_LLM_TEMPERATURE",
)
_VLM_ENV = (
    "HINDSIGHT_API_VLM_PROVIDER",
    "HINDSIGHT_API_VLM_MODEL",
    "HINDSIGHT_API_VLM_API_KEY",
    "HINDSIGHT_API_VLM_BASE_URL",
    "HINDSIGHT_API_VLM_REASONING_EFFORT",
)


def _clear_image_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (*_IMAGE_ENV, *_VLM_ENV):
        monkeypatch.delenv(name, raising=False)


def _tools(mcp_server):
    return {
        key.split(":")[1].split("@")[0]: value
        for key, value in mcp_server._local_provider._components.items()
        if key.startswith("tool:")
    }


class _RecordingConfig:
    def __init__(self, name: str) -> None:
        self.provider = name
        self.model = name
        self.temperatures: list[float | None] = []

    async def call(self, **kwargs):
        self.temperatures.append(kwargs.get("temperature"))
        return LLMCallResult(content={"facts": []}, usage=TokenUsage())


class _Loader:
    def __init__(self, attachments):
        self._attachments = attachments

    async def load(self, ids):
        return {i: self._attachments[i] for i in ids if i in self._attachments}


class _Eyes:
    """A stand-in vision model. ``answer`` is what supports_vision reports."""

    def __init__(self, answer: bool | None) -> None:
        self.answer = answer
        self.called = False
        self.kwargs: dict | None = None

    def supports_vision(self) -> bool | None:
        return self.answer

    async def call(self, **kwargs):
        self.called = True
        self.kwargs = kwargs
        return LLMCallResult(content="A red square.", usage=TokenUsage())


def test_image_temperature_does_not_inherit_global_or_retain(monkeypatch):
    monkeypatch.setenv("HINDSIGHT_API_LLM_TEMPERATURE", "0.7")
    monkeypatch.setenv("HINDSIGHT_API_LLM_TEMPERATURE_RETAIN", "0.4")
    monkeypatch.delenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_TEMPERATURE", raising=False)

    config = HindsightConfig.from_env()

    assert config.image_retain_llm_temperature is None
    assert config.llm_temperature_retain == 0.4


@pytest.mark.parametrize("raw", ["none", "NONE", "default", "off", "unset", ""])
def test_image_temperature_none_omits_and_leaves_retain_temperature(monkeypatch, raw):
    monkeypatch.setenv("HINDSIGHT_API_LLM_TEMPERATURE", "0.7")
    monkeypatch.setenv("HINDSIGHT_API_LLM_TEMPERATURE_RETAIN", "0.4")
    monkeypatch.setenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_TEMPERATURE", raw)

    config = HindsightConfig.from_env()

    assert config.image_retain_llm_temperature is None
    assert config.llm_temperature_retain == 0.4


def test_image_temperature_number_is_kept(monkeypatch):
    monkeypatch.setenv("HINDSIGHT_API_LLM_TEMPERATURE_RETAIN", "0.4")
    monkeypatch.setenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_TEMPERATURE", "0.2")

    config = HindsightConfig.from_env()

    assert config.image_retain_llm_temperature == 0.2
    assert config.llm_temperature_retain == 0.4


def test_image_model_falls_back_to_the_vision_slot_then_the_retain_model(monkeypatch):
    _clear_image_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_LLM_PROVIDER", "openai")
    monkeypatch.setenv("HINDSIGHT_API_LLM_MODEL", "text-model")
    monkeypatch.setenv("HINDSIGHT_API_LLM_API_KEY", "primary-key")
    monkeypatch.setenv("HINDSIGHT_API_VLM_PROVIDER", "anthropic")
    monkeypatch.setenv("HINDSIGHT_API_VLM_MODEL", "claude-haiku")
    monkeypatch.setenv("HINDSIGHT_API_VLM_API_KEY", "vlm-key")
    monkeypatch.setenv("HINDSIGHT_API_VLM_BASE_URL", "https://vlm.example/v1")

    settings = resolve_image_retain_model(HindsightConfig.from_env())

    assert settings.provider == "anthropic"
    assert settings.model == "claude-haiku"
    assert settings.api_key == "vlm-key"
    assert settings.base_url == "https://vlm.example/v1"

    _clear_image_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_PROVIDER", "openai")
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_MODEL", "gpt-oss")
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_API_KEY", "retain-key")
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_BASE_URL", "https://retain.example/v1")

    fallen_back = resolve_image_retain_model(HindsightConfig.from_env())

    assert fallen_back.provider == "openai"
    assert fallen_back.model == "gpt-oss"
    assert fallen_back.api_key == "retain-key"
    assert fallen_back.base_url == "https://retain.example/v1"


def test_image_settings_override_the_vision_slot_and_do_not_inherit_its_host(monkeypatch):
    _clear_image_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_VLM_PROVIDER", "openai")
    monkeypatch.setenv("HINDSIGHT_API_VLM_MODEL", "vision-model")
    monkeypatch.setenv("HINDSIGHT_API_VLM_BASE_URL", "https://vlm.example/v1")
    monkeypatch.setenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_PROVIDER", "groq")
    monkeypatch.setenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    monkeypatch.setenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_API_KEY", "image-key")

    settings = resolve_image_retain_model(HindsightConfig.from_env())

    assert settings.provider == "groq"
    assert settings.model == "meta-llama/llama-4-scout-17b-16e-instruct"
    assert settings.api_key == "image-key"
    assert settings.base_url == "https://api.groq.com/openai/v1"


def test_image_model_does_not_inherit_retain_extra_body_or_reasoning(monkeypatch):
    _clear_image_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_VLM_PROVIDER", "mock")
    monkeypatch.setenv("HINDSIGHT_API_VLM_MODEL", "vision-model")
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_REASONING_EFFORT", "xhigh")
    monkeypatch.setenv("HINDSIGHT_API_RETAIN_LLM_EXTRA_BODY", '{"temperature": 0.4}')
    clear_image_llm_cache()

    client = image_llm(HindsightConfig.from_env())

    assert client.model == "vision-model"
    assert client.extra_body is None
    assert client.reasoning_effort is None
    clear_image_llm_cache()


def test_image_llm_can_be_built_from_the_global_config_proxy(monkeypatch):
    """The worker reads ``get_config()``, which hides bank-configurable fields.

    ``llm_gemini_safety_settings`` is one of those. Reading it off the proxy
    fails the retain; the description client has to take the raw server value.
    """
    _clear_image_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_VLM_PROVIDER", "mock")
    monkeypatch.setenv("HINDSIGHT_API_VLM_MODEL", "vision-model")
    clear_config_cache()
    clear_image_llm_cache()

    client = image_llm(get_config())

    assert client.model == "vision-model"
    assert client.gemini_safety_settings is None
    clear_image_llm_cache()


def test_image_retain_is_server_level_and_its_credentials_stay_hidden():
    assert "image_retain_llm_api_key" in HindsightConfig._CREDENTIAL_FIELDS
    assert "image_retain_llm_base_url" in HindsightConfig._CREDENTIAL_FIELDS
    assert "image_retain_llm_provider" not in HindsightConfig._CONFIGURABLE_FIELDS
    assert "image_retain_llm_model" not in HindsightConfig._CONFIGURABLE_FIELDS
    assert "image_retain_llm_temperature" not in HindsightConfig._CONFIGURABLE_FIELDS


@pytest.mark.asyncio
async def test_an_attachment_chunk_still_uses_the_retain_temperature():
    """The regression: image temperature `none` must not change normal retain.

    The vision slot still receives ``llm_temperature_retain``. Pointing that
    slot at a model which rejects temperature is unchanged, and so is text retain.
    """
    retain = _RecordingConfig("retain-llm")
    vision = _RecordingConfig("vision-llm")
    loader = _Loader({ATTACHMENT_ID: LoadedAttachment(media_type="image/png", data=PNG)})
    config = replace(
        HindsightConfig.from_env(),
        llm_temperature_retain=0.4,
        image_retain_llm_temperature=None,
    )

    await _extract_facts_from_chunk(
        chunk="Plain prose with nothing attached to it.",
        chunk_index=0,
        total_chunks=1,
        event_date=datetime(2026, 1, 1),
        context="",
        llm_config=retain,
        config=config,
        attachment_loader=loader,
        vlm_config=vision,
    )
    await _extract_facts_from_chunk(
        chunk=f"Here is the diagram: {attachment_placeholder(ATTACHMENT_ID)}",
        chunk_index=0,
        total_chunks=1,
        event_date=datetime(2026, 1, 1),
        context="",
        llm_config=retain,
        config=config,
        attachment_loader=loader,
        vlm_config=vision,
    )

    assert retain.temperatures == [0.4]
    assert vision.temperatures == [0.4]


@pytest.mark.asyncio
async def test_describe_passes_temperature_through_and_builds_image_parts():
    eyes = _Eyes(None)

    text = await describe_images(
        eyes,
        images=[PreparedImage(media_type="image/png", data=PNG)],
        caption="diagram",
        temperature=None,
    )

    assert text == "A red square."
    assert eyes.called
    assert eyes.kwargs is not None
    assert eyes.kwargs["temperature"] is None
    assert eyes.kwargs["scope"] == "image_retain_describe"
    assert "response_format" not in eyes.kwargs
    user = eyes.kwargs["messages"][1]["content"]
    assert any(part.get("type") == "image_url" for part in user)
    assert eyes.kwargs["messages"][0]["content"] == DESCRIBE_PROMPT


@pytest.mark.asyncio
async def test_describe_refuses_a_model_that_cannot_see():
    eyes = _Eyes(False)

    with pytest.raises(ImageRetainRejected, match="cannot read images"):
        await describe_images(
            eyes,
            images=[PreparedImage(media_type="image/png", data=PNG)],
            caption=None,
            temperature=None,
        )

    assert eyes.called is False


@pytest.mark.asyncio
async def test_expand_leaves_a_normal_retain_untouched():
    contents = [{"content": "hello", "context": "general"}]

    assert await expand_queued_images(None, contents) is contents


@pytest.mark.asyncio
async def test_expand_replaces_the_marker_with_the_description(monkeypatch):
    monkeypatch.delenv("HINDSIGHT_API_IMAGE_RETAIN_LLM_TEMPERATURE", raising=False)
    clear_config_cache()
    seen: dict = {}

    async def fake_describe(llm, *, images, caption, temperature):
        seen["temperature"] = temperature
        seen["media_type"] = images[0].media_type
        seen["nbytes"] = len(images[0].data)
        return "A red square."

    monkeypatch.setattr("hindsight_api.image_retain.describe_images", fake_describe)
    monkeypatch.setattr("hindsight_api.image_retain.image_llm", lambda config: object())
    memory = MagicMock()
    memory._file_storage.retrieve = AsyncMock(return_value=PNG)
    contents = [
        {
            "content": "diagram",
            "context": "general",
            "tags": ["image"],
            MARKER: {"images": [{"media_type": "image/png", "storage_key": "tenants/x/blob"}], "caption": "diagram"},
        }
    ]

    expanded = await expand_queued_images(memory, contents, bank_id="bank-1")

    assert expanded[0]["content"] == "diagram\n\nA red square."
    assert expanded[0]["context"] == "general"
    assert expanded[0]["tags"] == ["image"]
    assert MARKER not in expanded[0]
    assert seen == {"temperature": None, "media_type": "image/png", "nbytes": len(PNG)}
    assert DESCRIBE_PROMPT.startswith("Describe each image faithfully for later fact extraction.")


def _memory():
    memory = MagicMock()
    memory.submit_async_retain = AsyncMock(return_value={"operation_id": "op-1"})
    memory.resolve_bank_alias = AsyncMock(side_effect=lambda bank_id, **_: bank_id)
    memory.refuse_knowledge_bank = AsyncMock(return_value=None)
    stored: dict[str, bytes] = {}

    async def store(file_data, key, metadata=None):
        stored[key] = file_data
        return key

    memory._file_storage.store = AsyncMock(side_effect=store)
    memory._file_storage.delete = AsyncMock()
    memory._stored = stored
    return memory


async def _call(memory, *, multi_bank: bool, **kwargs):
    from hindsight_api.api.mcp import _current_bank_id, create_mcp_server

    mcp = create_mcp_server(memory, multi_bank=multi_bank)
    tool = _tools(mcp)["retain_image"]
    token = _current_bank_id.set("bank-1")
    try:
        if multi_bank:
            return json.loads(await tool.fn(bank_id="bank-1", **kwargs))
        return await tool.fn(**kwargs)
    finally:
        _current_bank_id.reset(token)


@pytest.mark.asyncio
@pytest.mark.parametrize("multi_bank", [False, True])
async def test_retain_image_queues_bytes_outside_the_task_payload(multi_bank):
    memory = _memory()

    result = await _call(
        memory,
        multi_bank=multi_bank,
        images=[{"media_type": "image/png", "data": PNG_B64, "url": "https://example.com/ignored.png"}],
        caption="diagram",
        tags=["image"],
        document_id="shot-1",
    )

    assert result["status"] == "accepted"
    assert result["operation_id"] == "op-1"
    item = memory.submit_async_retain.call_args.kwargs["contents"][0]
    assert item["content"] == "diagram"
    assert PNG_B64 not in json.dumps(item)
    assert item["document_id"] == "shot-1"
    marker = item[MARKER]
    assert "url" not in marker["images"][0]
    key = marker["images"][0]["storage_key"]
    assert memory._stored[key] == PNG
    assert memory.submit_async_retain.call_args.kwargs["bank_id"] == "bank-1"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("images", "match"),
    [
        ([{"media_type": "application/pdf", "data": PNG_B64}], "images only"),
        ([], "at least one image"),
        ([{"media_type": "image/png"}], "data"),
        ([{"mime_type": "image/png", "url": "file:///etc/passwd"}], "Image URL"),
        ([{"media_type": "image/png", "url": "http://169.254.169.254/latest"}], "Image"),
        ([{"media_type": "image/png", "data": "data:application/pdf;base64,YQ=="}], "not an image"),
    ],
)
async def test_retain_image_rejects_non_images(images, match):
    memory = _memory()

    result = await _call(memory, multi_bank=False, images=images)

    assert "error" in result
    assert match.lower() in result["error"].lower()
    memory.submit_async_retain.assert_not_called()
    memory._file_storage.store.assert_not_called()


@pytest.mark.asyncio
async def test_a_url_only_image_is_not_stored_as_bytes():
    memory = _memory()

    result = await _call(
        memory,
        multi_bank=False,
        images=[{"media_type": "image/jpeg", "url": "https://example.com/a.jpg"}],
    )

    assert result["status"] == "accepted"
    memory._file_storage.store.assert_not_called()
    marker = memory.submit_async_retain.call_args.kwargs["contents"][0][MARKER]
    assert marker["images"][0]["url"] == "https://example.com/a.jpg"
    assert "storage_key" not in marker["images"][0]


def test_allowlist_can_name_retain_image_without_retain():
    from hindsight_api.api.mcp import create_mcp_server

    memory = _memory()

    def listed(enabled):
        mock_cfg = MagicMock()
        mock_cfg.mcp_enabled_tools = enabled
        mock_cfg.mcp_instructions = None
        with patch("hindsight_api.api.mcp._get_raw_config", return_value=mock_cfg):
            return set(_tools(create_mcp_server(memory, multi_bank=False)))

    assert "retain_image" not in listed(["retain"])
    assert listed(["retain_image"]) == {"retain_image"}
    assert "retain_image" in listed(None)


def test_parse_allowlist_is_what_a_public_image_url_is_checked_against():
    """Guard the import the tool uses: an empty allowlist still parses."""
    assert parse_allowlist([]).hostnames == frozenset()
