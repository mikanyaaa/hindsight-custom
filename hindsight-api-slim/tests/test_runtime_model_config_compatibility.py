"""Runtime model configuration stays external across the v1.2.0 upgrade.

Stored memories were embedded with the local default model at dimension 384.
Startup must keep that default unless the process environment selects another
provider or model, and an explicit environment value must be used as given.
"""

import os

from hindsight_api.config import (
    DEFAULT_DECISION_MODEL_PROVIDER,
    DEFAULT_EMBEDDING_DIMENSION,
    DEFAULT_EMBEDDINGS_LOCAL_MODEL,
    DEFAULT_EMBEDDINGS_PROVIDER,
    DEFAULT_LLM_PROVIDER,
    HindsightConfig,
)


def _clear_hindsight_env(monkeypatch) -> None:
    for key in list(os.environ):
        if key.startswith("HINDSIGHT_API_"):
            monkeypatch.delenv(key, raising=False)


def test_local_embedding_defaults_match_existing_vectors():
    assert DEFAULT_EMBEDDINGS_PROVIDER == "local"
    assert DEFAULT_EMBEDDINGS_LOCAL_MODEL == "BAAI/bge-small-en-v1.5"
    assert DEFAULT_EMBEDDING_DIMENSION == 384
    assert DEFAULT_LLM_PROVIDER == "openai"
    assert DEFAULT_DECISION_MODEL_PROVIDER == "none"


def test_unset_environment_does_not_select_a_hosted_model(monkeypatch):
    _clear_hindsight_env(monkeypatch)

    config = HindsightConfig.from_env()

    assert config.embeddings_provider == "local"
    assert config.embeddings_local_model == "BAAI/bge-small-en-v1.5"
    assert config.llm_provider == "openai"
    assert config.decision_model_provider == "none"
    assert config.llm_model != "hs-decide-1-flash"
    assert config.embeddings_provider != "hindsight"


def test_environment_overrides_are_kept_verbatim(monkeypatch):
    _clear_hindsight_env(monkeypatch)
    monkeypatch.setenv("HINDSIGHT_API_LLM_PROVIDER", "openai")
    monkeypatch.setenv("HINDSIGHT_API_LLM_MODEL", "gpt-4o-mini")
    monkeypatch.setenv("HINDSIGHT_API_EMBEDDINGS_PROVIDER", "onnx")
    monkeypatch.setenv("HINDSIGHT_API_EMBEDDINGS_ONNX_MODEL_ID", "example/embed-keep")
    monkeypatch.setenv("HINDSIGHT_API_EMBEDDINGS_LOCAL_MODEL", "example/embed-keep")
    monkeypatch.setenv("HINDSIGHT_API_RERANKER_PROVIDER", "local")
    monkeypatch.setenv("HINDSIGHT_API_RERANKER_LOCAL_MODEL", "example/rerank-keep")

    config = HindsightConfig.from_env()

    assert config.llm_provider == "openai"
    assert config.llm_model == "gpt-4o-mini"
    assert config.embeddings_provider == "onnx"
    assert config.embeddings_onnx_model_id == "example/embed-keep"
    assert config.embeddings_local_model == "example/embed-keep"
    assert config.embeddings_local_model != "BAAI/bge-small-en-v1.5"
    assert config.reranker_provider == "local"
    assert config.reranker_local_model == "example/rerank-keep"
    assert config.reranker_local_model != "hindsight-ai/hs-rerank-1"
    assert config.decision_model_provider == "none"
