"""MCP ``retain_image``: describe images with their own model, then retain the prose.

Normal retain, including its vision slot, keeps sending the retain temperature.
That is the wrong knob for a model that rejects ``temperature`` (Claude Haiku on
OpenRouter): setting ``HINDSIGHT_API_LLM_TEMPERATURE_RETAIN=none`` would also
change text retain. This tool does not touch that setting.

Two steps, one async retain:

1. A vision model describes the images. Its provider, model, key, base URL, and
   temperature come from ``HINDSIGHT_API_IMAGE_RETAIN_LLM_*``, falling back to
   the vision slot and then the retain LLM. Unset temperature omits the
   parameter. It does not inherit the global or retain temperature, the retain
   ``extra_body``, or the retain reasoning effort.
2. The description is ordinary text. Fact extraction uses the retain model and
   the retain temperature, the same path as any other document.

Image bytes go to file storage, not the operation row. The worker reads them
back, describes them, and deletes them after the retain succeeds so a retry can
still see them. URL fetches use the webhook SSRF guard and do not follow
redirects.

``HINDSIGHT_API_LLM_VISION`` stays on the normal retain path. A gateway that
reports "unknown" is allowed here; only an explicit "no" from the image model's
own provider is refused.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import threading
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import aiohttp
from pydantic import BaseModel, Field, ValidationError, model_validator

from hindsight_api.config import HindsightConfig, StaticConfigProxy, get_config
from hindsight_api.engine.aiohttp_session import LoopLocalSession, per_phase_timeout
from hindsight_api.engine.llm_wrapper import LLMConfig
from hindsight_api.engine.retain.attachment_content import (
    LoadedAttachment,
    attachment_placeholder,
    build_prompt_parts,
    compute_attachment_hash,
    short_attachment_id,
)
from hindsight_api.engine.storage import bank_storage_prefix
from hindsight_api.mcp_tools import (
    MCPToolsConfig,
    _get_request_context,
    _run_tool,
    _tool_annotations,
    build_content_dict,
)
from hindsight_api.webhooks.url_guard import (
    Allowlist,
    GuardedResolver,
    WebhookURLError,
    parse_allowlist,
    validate_url_syntax,
)

logger = logging.getLogger(__name__)

# The system-test stub identifies this call by the sentence. Keep it stable.
DESCRIBE_PROMPT = (
    "Describe each image faithfully for later fact extraction. "
    "State what is visible: objects, text, people, layout, and any numbers. "
    "Do not invent details that are not in the image."
)

MARKER = "_image_retain"
SCOPE = "image_retain_describe"
_FETCH_TIMEOUT_SECONDS = 60.0
_IMAGE_TYPE = re.compile(r"^image/[a-z0-9][a-z0-9.+-]*$")
_DATA_URI = re.compile(r"^data:([^;,]+)?(;base64)?,(.*)$", re.IGNORECASE | re.DOTALL)

RETAIN_IMAGE_DESCRIPTION = (
    "Store one or more images in long-term memory. A vision model describes each image, "
    "then fact extraction runs on that description with the retain model. "
    "Accepts images only (image/*), as base64 data and/or an http(s) URL. "
    "Returns immediately with an operation_id, the same way retain does."
)


class ImageRetainRejected(ValueError):
    """The caller sent something ``retain_image`` will not store."""


class RetainImageInput(BaseModel):
    """One image. ``media_type`` and ``mime_type`` are the same fact."""

    media_type: str | None = None
    mime_type: str | None = None
    data: str | None = None
    url: str | None = None

    @model_validator(mode="after")
    def _image_with_a_source(self) -> RetainImageInput:
        media = (self.media_type or self.mime_type or "").strip().lower()
        if not media:
            raise ValueError("each image needs media_type (or mime_type)")
        if _IMAGE_TYPE.fullmatch(media) is None:
            raise ValueError(f"retain_image accepts images only (image/*). Got {media}.")
        has_data = bool(self.data and self.data.strip())
        has_url = bool(self.url and self.url.strip())
        if not has_data and not has_url:
            raise ValueError("each image needs data (base64) or url")
        self.media_type = media
        return self


class QueuedImage(BaseModel):
    """Where the worker finds one image. Bytes live in file storage, not here."""

    media_type: str
    storage_key: str | None = None
    url: str | None = None

    @model_validator(mode="after")
    def _has_source(self) -> QueuedImage:
        if not self.storage_key and not self.url:
            raise ValueError("queued image has neither bytes nor a url")
        return self


class QueuedImageRetain(BaseModel):
    """Marker on a queued retain item. Stripped before fact extraction."""

    images: list[QueuedImage] = Field(min_length=1)
    caption: str | None = None


@dataclass(frozen=True)
class AcceptedImage:
    """An image that passed validation, either as bytes or as a URL still to fetch."""

    media_type: str
    data: bytes | None
    url: str | None


@dataclass(frozen=True)
class PreparedImage:
    """Bytes the vision model will actually see."""

    media_type: str
    data: bytes


@dataclass(frozen=True)
class ImageRetainSettings:
    """The description call's identity. Temperature is per call, not part of the client."""

    provider: str
    model: str
    api_key: str
    base_url: str
    temperature: float | None
    reasoning_effort: str | None


def resolve_image_retain_model(config: HindsightConfig | StaticConfigProxy) -> ImageRetainSettings:
    """Image-retain env, else the vision slot, else the retain LLM, else the primary LLM.

    A base URL follows the provider that was actually named. Setting
    ``HINDSIGHT_API_IMAGE_RETAIN_LLM_PROVIDER`` without a URL uses that
    provider's default host, never the vision slot's or the retain model's.
    """
    provider = (
        config.image_retain_llm_provider or config.vlm_provider or config.retain_llm_provider or config.llm_provider
    )
    model = config.image_retain_llm_model or config.vlm_model or config.retain_llm_model or config.llm_model
    api_key = (
        config.image_retain_llm_api_key or config.vlm_api_key or config.retain_llm_api_key or config.llm_api_key or ""
    )
    if config.image_retain_llm_base_url:
        base_url = config.image_retain_llm_base_url
    elif config.image_retain_llm_provider:
        base_url = _default_base_url(config.image_retain_llm_provider)
    elif config.vlm_base_url:
        base_url = config.vlm_base_url
    elif config.vlm_provider:
        base_url = _default_base_url(config.vlm_provider)
    elif config.retain_llm_base_url:
        base_url = config.retain_llm_base_url
    elif config.retain_llm_provider:
        base_url = _default_base_url(config.retain_llm_provider) or config.llm_base_url or ""
    else:
        base_url = config.llm_base_url or _default_base_url(config.llm_provider)
    return ImageRetainSettings(
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url or "",
        # None omits the parameter. Never the global temperature, never retain's.
        temperature=config.image_retain_llm_temperature,
        # The vision slot's own effort only. Retain's `xhigh` must not ride along.
        reasoning_effort=config.vlm_reasoning_effort,
    )


def _default_base_url(provider: str | None) -> str:
    from hindsight_api.engine.memory_engine import _provider_default_base_url

    return _provider_default_base_url(provider)


def _pick(config: HindsightConfig | StaticConfigProxy, name: str) -> Any:
    """Vision slot, then retain, then the global LLM. Used for timeout and retries only."""
    for prefix in ("vlm_", "retain_llm_", "llm_"):
        value = getattr(config, f"{prefix}{name}")
        if value is not None:
            return value
    return None


_llm_cache: dict[tuple[Any, ...], Any] = {}
_llm_cache_lock = threading.Lock()


def clear_image_llm_cache() -> None:
    """Drop cached description clients. Tests use this; production does not."""
    with _llm_cache_lock:
        _llm_cache.clear()


def image_llm(config: HindsightConfig | StaticConfigProxy) -> Any:
    """The description client. Cached by everything that builds it, not by temperature.

    ``extra_body`` is always empty. A retain ``extra_body`` that carries
    ``temperature`` would put the parameter back on a model that rejects it.
    """
    from hindsight_api.config import _get_raw_config

    settings = resolve_image_retain_model(config)
    # Bank-configurable, so the global proxy refuses it. The raw config is the
    # server default; a per-bank override is not this call's concern.
    safety_settings = _get_raw_config().llm_gemini_safety_settings
    header_key = (
        json.dumps(config.llm_default_headers, sort_keys=True, default=str) if config.llm_default_headers else ""
    )
    safety_key = json.dumps(safety_settings, sort_keys=True, default=str) if safety_settings else ""
    key = (
        settings.provider,
        settings.model,
        settings.api_key,
        settings.base_url,
        settings.reasoning_effort,
        _pick(config, "timeout"),
        _pick(config, "max_retries"),
        _pick(config, "initial_backoff"),
        _pick(config, "max_backoff"),
        header_key,
        safety_key,
    )
    with _llm_cache_lock:
        cached = _llm_cache.get(key)
        if cached is not None:
            return cached
        client = LLMConfig(
            provider=settings.provider,
            api_key=settings.api_key,
            base_url=settings.base_url,
            model=settings.model,
            reasoning_effort=settings.reasoning_effort,
            extra_body=None,
            default_headers=config.llm_default_headers,
            timeout=_pick(config, "timeout"),
            max_retries=_pick(config, "max_retries"),
            initial_backoff=_pick(config, "initial_backoff"),
            max_backoff=_pick(config, "max_backoff"),
            groq_service_tier=config.llm_groq_service_tier,
            openai_service_tier=config.llm_openai_service_tier,
            bedrock_service_tier=config.llm_bedrock_service_tier,
            gemini_service_tier=config.llm_gemini_service_tier,
            gemini_safety_settings=safety_settings,
            prompt_cache_enabled=config.llm_prompt_cache_enabled,
            ollama_num_ctx=config.llm_ollama_num_ctx,
            structured_output_in_prompt=config.llm_structured_output_in_prompt,
            codex_home=config.llm_codex_home,
            vertexai_project_id=config.llm_vertexai_project_id,
            vertexai_region=config.llm_vertexai_region,
            vertexai_service_account_key=config.llm_vertexai_service_account_key,
        )
        _llm_cache[key] = client
        return client


def _as_input(image: RetainImageInput | dict[str, Any]) -> RetainImageInput:
    if isinstance(image, RetainImageInput):
        return image
    try:
        return RetainImageInput.model_validate(image)
    except ValidationError as exc:
        raise ImageRetainRejected(_validation_message(exc)) from exc


def _validation_message(exc: ValidationError) -> str:
    messages = []
    for error in exc.errors():
        text = str(error.get("msg", "")).removeprefix("Value error, ").strip()
        if text and text not in messages:
            messages.append(text)
    return " ".join(messages) or "retain_image input is invalid."


def accept_images(
    images: Sequence[RetainImageInput | dict[str, Any]],
    *,
    max_count: int,
    max_bytes: int,
    allowlist: Allowlist,
) -> list[AcceptedImage]:
    """Reject non-images before anything is stored or queued.

    When an image has both ``data`` and ``url``, the bytes are what is retained
    and the URL is not fetched.
    """
    if not images:
        raise ImageRetainRejected("retain_image requires at least one image.")
    if len(images) > max_count:
        raise ImageRetainRejected(f"retain_image accepts at most {max_count} images per call.")
    accepted: list[AcceptedImage] = []
    for raw in images:
        image = _as_input(raw)
        media = image.media_type or ""
        if image.data and image.data.strip():
            prepared = _decode_image(image.data, media)
            if len(prepared.data) > max_bytes:
                raise ImageRetainRejected(f"Image is {len(prepared.data)} bytes, over the {max_bytes} byte limit.")
            accepted.append(AcceptedImage(media_type=prepared.media_type, data=prepared.data, url=None))
            continue
        url = (image.url or "").strip()
        try:
            validate_url_syntax(url, allowlist)
        except WebhookURLError as exc:
            raise ImageRetainRejected(_public_url_error(exc)) from exc
        accepted.append(AcceptedImage(media_type=media, data=None, url=url))
    return accepted


def _decode_image(data: str, declared: str) -> PreparedImage:
    raw = data.strip()
    media_type = declared
    if raw.lower().startswith("data:"):
        match = _DATA_URI.match(raw)
        if match is None:
            raise ImageRetainRejected("Image data is not valid base64 or a data URI.")
        uri_type = (match.group(1) or "").strip().lower()
        if uri_type and not uri_type.startswith("image/"):
            raise ImageRetainRejected(
                f"Image data URI is {uri_type}, which is not an image. retain_image accepts images only."
            )
        if match.group(2) is None:
            raise ImageRetainRejected("Image data URI must be base64-encoded.")
        if uri_type.startswith("image/"):
            media_type = uri_type
        raw = match.group(3)
    raw = "".join(raw.split())
    try:
        blob = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise ImageRetainRejected("Image data is not valid base64.") from exc
    if not blob:
        raise ImageRetainRejected("Image data is empty.")
    return PreparedImage(media_type=media_type, data=blob)


def _public_url_error(exc: WebhookURLError) -> str:
    return str(exc).replace("Webhook", "Image")


async def queue_retain_image(
    memory: Any,
    config: MCPToolsConfig,
    bank_id: str,
    images: Sequence[RetainImageInput | dict[str, Any]],
    *,
    context: str,
    caption: str | None,
    timestamp: str | None,
    tags: list[str] | None,
    metadata: dict[str, str] | None,
    document_id: str | None,
    strategy: str | None,
    update_mode: str | None,
) -> dict[str, Any]:
    """Validate, stash bytes, and submit one async retain carrying the marker."""
    server = get_config()
    accepted = accept_images(
        images,
        max_count=server.retain_attachment_max_count,
        max_bytes=server.retain_attachment_max_size_bytes,
        allowlist=parse_allowlist(list(server.webhook_allowed_hosts)),
    )
    caption_text = caption.strip() if caption and caption.strip() else None
    placeholder = caption_text or "Image"
    content_dict, error = build_content_dict(
        placeholder, context, timestamp, tags, metadata, document_id, strategy, update_mode
    )
    if error:
        raise ImageRetainRejected(error)

    stored: list[str] = []
    queued: list[QueuedImage] = []
    try:
        for image in accepted:
            if image.data is None:
                queued.append(QueuedImage(media_type=image.media_type, url=image.url))
                continue
            key = f"{bank_storage_prefix(bank_id)}image-retain/{uuid.uuid4().hex}"
            await memory._file_storage.store(image.data, key, metadata={"content_type": image.media_type})
            stored.append(key)
            queued.append(QueuedImage(media_type=image.media_type, storage_key=key))
        content_dict[MARKER] = QueuedImageRetain(images=queued, caption=caption_text).model_dump(exclude_none=True)
        result = await memory.submit_async_retain(
            bank_id=bank_id,
            contents=[content_dict],
            strategy=content_dict.get("strategy"),
            request_context=_get_request_context(config),
        )
    except Exception:
        await discard_image_retain_blobs(memory, stored)
        raise
    operation_id = result.get("operation_id") if isinstance(result, dict) else None
    return {
        "status": "accepted",
        "message": "Image storage initiated",
        "operation_id": operation_id,
    }


def _register_retain_image(mcp: Any, memory: Any, config: MCPToolsConfig) -> None:
    """Register both copies. The bank-id copy is first so the parity check sees it as multi-bank."""
    description = RETAIN_IMAGE_DESCRIPTION

    if config.include_bank_id_param:

        @mcp.tool(description=description, annotations=_tool_annotations("retain_image"), output_schema=None)
        async def retain_image(
            images: list[RetainImageInput],
            context: str = "general",
            caption: str | None = None,
            timestamp: str | None = None,
            tags: list[str] | None = None,
            metadata: dict[str, str] | None = None,
            document_id: str | None = None,
            bank_id: str | None = None,
            strategy: str | None = None,
            update_mode: str | None = None,
        ) -> str:
            """
            Args:
                images: One or more images. Each has media_type (or mime_type) and data (base64) and/or url.
                context: Category for the memory (default: general).
                caption: Optional text stored with the description.
                timestamp: When this occurred (ISO 8601).
                tags: Optional tags for scoped visibility filtering.
                metadata: Optional key-value metadata.
                document_id: Optional document ID to associate this memory with.
                bank_id: Bank to store in. Defaults to the session bank.
                strategy: Optional named retain strategy.
                update_mode: How to handle an existing document with the same document_id (replace or append).
            """

            async def queue_for_bank(bank: str) -> dict[str, Any]:
                return await queue_retain_image(
                    memory,
                    config,
                    bank,
                    images,
                    context=context,
                    caption=caption,
                    timestamp=timestamp,
                    tags=tags,
                    metadata=metadata,
                    document_id=document_id,
                    strategy=strategy,
                    update_mode=update_mode,
                )

            return await _run_tool(
                config,
                bank_id=bank_id,
                as_json=True,
                action="storing images",
                run=queue_for_bank,
                value_error="rejection",
            )

    else:

        @mcp.tool(description=description, annotations=_tool_annotations("retain_image"))
        async def retain_image(
            images: list[RetainImageInput],
            context: str = "general",
            caption: str | None = None,
            timestamp: str | None = None,
            tags: list[str] | None = None,
            metadata: dict[str, str] | None = None,
            document_id: str | None = None,
            strategy: str | None = None,
            update_mode: str | None = None,
        ) -> dict:
            """
            Args:
                images: One or more images. Each has media_type (or mime_type) and data (base64) and/or url.
                context: Category for the memory (default: general).
                caption: Optional text stored with the description.
                timestamp: When this occurred (ISO 8601).
                tags: Optional tags for scoped visibility filtering.
                metadata: Optional key-value metadata.
                document_id: Optional document ID to associate this memory with.
                strategy: Optional named retain strategy.
                update_mode: How to handle an existing document with the same document_id (replace or append).
            """

            async def queue_for_session(bank: str) -> dict[str, Any]:
                return await queue_retain_image(
                    memory,
                    config,
                    bank,
                    images,
                    context=context,
                    caption=caption,
                    timestamp=timestamp,
                    tags=tags,
                    metadata=metadata,
                    document_id=document_id,
                    strategy=strategy,
                    update_mode=update_mode,
                )

            return await _run_tool(
                config,
                bank_id=None,
                as_json=False,
                action="storing images",
                run=queue_for_session,
                value_error="rejection",
            )


def queued_image_storage_keys(contents: Sequence[Any]) -> list[str]:
    """Storage keys referenced by queued image retains. Empty for an ordinary retain."""
    keys: list[str] = []
    for item in contents:
        if not isinstance(item, dict):
            continue
        marker = item.get(MARKER)
        if not isinstance(marker, dict):
            continue
        for image in marker.get("images") or []:
            if isinstance(image, dict):
                key = image.get("storage_key")
                if isinstance(key, str) and key:
                    keys.append(key)
    return keys


async def discard_image_retain_blobs(memory: Any, keys: Sequence[str]) -> None:
    """Best-effort delete. A storage blip must not fail a retain that already succeeded."""
    for key in keys:
        try:
            await memory._file_storage.delete(key)
        except Exception:
            logger.warning("could not delete image-retain blob %s", key, exc_info=True)


async def expand_queued_images(memory: Any, contents: list[Any], *, bank_id: str | None = None) -> list[Any]:
    """Replace image-retain markers with the description. Other items are untouched.

    Returns the same list when nothing is marked, so an ordinary retain does no
    extra work beyond one scan.
    """
    if not any(isinstance(item, dict) and MARKER in item for item in contents):
        return contents
    config = get_config()
    settings = resolve_image_retain_model(config)
    llm = image_llm(config)
    expanded: list[Any] = []
    for item in contents:
        if not isinstance(item, dict) or MARKER not in item:
            expanded.append(item)
            continue
        expanded.append(await _expand_one(memory, item, llm=llm, temperature=settings.temperature, bank_id=bank_id))
    return expanded


async def _expand_one(
    memory: Any,
    item: dict[str, Any],
    *,
    llm: Any,
    temperature: float | None,
    bank_id: str | None,
) -> dict[str, Any]:
    try:
        queued = QueuedImageRetain.model_validate(item[MARKER])
    except ValidationError as exc:
        raise ImageRetainRejected("retain_image payload is invalid.") from exc
    prepared: list[PreparedImage] = []
    server = get_config()
    max_bytes = server.retain_attachment_max_size_bytes
    allowlist = parse_allowlist(list(server.webhook_allowed_hosts))
    for image in queued.images:
        if image.storage_key:
            try:
                data = await memory._file_storage.retrieve(image.storage_key)
            except FileNotFoundError as exc:
                raise ImageRetainRejected(
                    "The stored image for this retain is no longer available, so it cannot be described."
                ) from exc
            prepared.append(PreparedImage(media_type=image.media_type, data=data))
            continue
        if not image.url:
            raise ImageRetainRejected("retain_image payload is invalid.")
        prepared.append(await _fetch_image(image.url, image.media_type, max_bytes=max_bytes, allowlist=allowlist))
    logger.info(
        "retain_image describing %d image(s) for bank=%s model=%s",
        len(prepared),
        bank_id,
        getattr(llm, "model", None),
    )
    description = await describe_images(llm, images=prepared, caption=queued.caption, temperature=temperature)
    text = f"{queued.caption.strip()}\n\n{description}" if queued.caption and queued.caption.strip() else description
    replaced = {key: value for key, value in item.items() if key != MARKER}
    replaced["content"] = text
    return replaced


def _vision_answer(llm: Any) -> bool | None:
    """The image model's own answer, not ``HINDSIGHT_API_LLM_VISION``.

    That flag gates normal retain. Gateways report unknown (``None``); this tool
    proceeds on unknown and refuses only an explicit ``False``.
    """
    impl = getattr(llm, "_provider_impl", None)
    if impl is not None and hasattr(impl, "supports_vision"):
        return impl.supports_vision()
    reporter = getattr(llm, "supports_vision", None)
    if callable(reporter):
        return reporter()
    return None


async def describe_images(
    llm: Any,
    *,
    images: Sequence[PreparedImage],
    caption: str | None,
    temperature: float | None,
) -> str:
    """Ask the image model for prose. ``temperature=None`` omits the parameter."""
    if _vision_answer(llm) is False:
        raise ImageRetainRejected(
            "The image retain model reports that it cannot read images. "
            "Set HINDSIGHT_API_IMAGE_RETAIN_LLM_MODEL to a vision model."
        )
    loaded: dict[str, LoadedAttachment] = {}
    pieces: list[str] = []
    for image in images:
        # The placeholder and the lookup key are the short id, which is what
        # build_prompt_parts extracts. The full digest would miss and the image
        # would be replaced with "attachment unavailable".
        short_id = short_attachment_id(compute_attachment_hash(image.data))
        loaded[short_id] = LoadedAttachment(media_type=image.media_type, data=image.data)
        pieces.append(attachment_placeholder(short_id))
    intro = caption.strip() if caption and caption.strip() else "Image to retain."
    user = build_prompt_parts(f"{intro}\n\n" + "\n\n".join(pieces), loaded)
    result = await llm.call(
        messages=[
            {"role": "system", "content": DESCRIBE_PROMPT},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        scope=SCOPE,
    )
    text = result.content.strip() if isinstance(result.content, str) else str(result.content or "").strip()
    if not text:
        raise RuntimeError("The image model returned an empty description.")
    return text


_fetch_sessions: dict[tuple[Any, ...], LoopLocalSession] = {}
_fetch_sessions_lock = threading.Lock()


def _session_for(allowlist: Allowlist) -> LoopLocalSession:
    key = (allowlist.hostnames, allowlist.networks)
    with _fetch_sessions_lock:
        session = _fetch_sessions.get(key)
        if session is None:
            session = LoopLocalSession(
                timeout=per_phase_timeout(_FETCH_TIMEOUT_SECONDS),
                connector_factory=lambda: aiohttp.TCPConnector(
                    resolver=GuardedResolver(allowlist), use_dns_cache=False
                ),
                trust_env=False,
            )
            _fetch_sessions[key] = session
        return session


async def _fetch_image(url: str, declared: str, *, max_bytes: int, allowlist: Allowlist) -> PreparedImage:
    """GET an image. Redirects are not followed. The webhook guard blocks private hosts."""
    try:
        validate_url_syntax(url, allowlist)
    except WebhookURLError as exc:
        raise ImageRetainRejected(_public_url_error(exc)) from exc
    session = _session_for(allowlist).get()
    mime = ""
    data = b""
    try:
        async with session.get(url, allow_redirects=False) as response:
            if response.status in (301, 302, 303, 307, 308):
                raise ImageRetainRejected("Image URL redirects are not followed.")
            if response.status >= 400:
                raise ImageRetainRejected(f"Image URL returned HTTP {response.status}.")
            mime = (response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
            if mime and not mime.startswith("image/"):
                raise ImageRetainRejected(
                    f"Image URL returned {mime}, which is not an image. retain_image accepts images only."
                )
            if response.content_length is not None and response.content_length > max_bytes:
                raise ImageRetainRejected(
                    f"Image URL is {response.content_length} bytes, over the {max_bytes} byte limit."
                )
            data = await response.content.read(max_bytes + 1)
    except ImageRetainRejected:
        raise
    except WebhookURLError as exc:
        raise ImageRetainRejected(_public_url_error(exc)) from exc
    except aiohttp.ClientError as exc:
        cause: BaseException | None = exc
        while cause is not None:
            if isinstance(cause, WebhookURLError):
                raise ImageRetainRejected(_public_url_error(cause)) from exc
            cause = cause.__cause__ or cause.__context__
        raise
    if len(data) > max_bytes:
        raise ImageRetainRejected(f"Image URL is {len(data)} bytes, over the {max_bytes} byte limit.")
    if not data:
        raise ImageRetainRejected("Image URL returned an empty body.")
    return PreparedImage(media_type=mime or declared, data=data)
