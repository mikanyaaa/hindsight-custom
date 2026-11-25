"""
Typed metadata models for async operations.

These dataclasses define the structure of result_metadata for different operation types.
The metadata is exposed in the API for debugging purposes and may change without notice.
"""

from dataclasses import asdict, dataclass, field
from typing import TYPE_CHECKING, Any, Mapping

if TYPE_CHECKING:
    # Type-only: importing it for real is a cycle. This module is pulled in very
    # early by memory_engine, while mental_model_refresh reaches the search
    # package, which imports back from memory_engine.
    from .mental_model_refresh import RefreshFailureReason, RefreshOperationOutcome

MAX_EXTRACTION_ERROR_SAMPLES = 5
# A retain's unit ids are useful to the caller that waited for it (MCP sync_retain).
# Past this many, the operations row would be a second copy of the unit table, so
# the list is omitted and memory_ids_truncated is set instead.
MAX_RETAIN_RESULT_MEMORY_IDS = 200

_REFLECT_TRACE_FIELDS = ("tool_trace", "llm_trace", "directives_applied")
_MISSING = object()


@dataclass
class BatchRetainParentMetadata:
    """Metadata for parent batch_retain operations (when split into sub-batches)."""

    items_count: int
    total_tokens: int
    num_sub_batches: int
    is_parent: bool = True
    # Set only when the whole batch targets a single document, so the operations
    # list surfaces which document an in-flight retain is (re)writing. The
    # documents UI cross-checks this to badge rows as "updating". Multi-document
    # batches leave it None and are matched per single-document child instead.
    document_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization, omitting document_id when unset."""
        data = asdict(self)
        if data.get("document_id") is None:
            data.pop("document_id", None)
        return data


@dataclass
class BatchRetainChildMetadata:
    """Metadata for child batch_retain operations (individual sub-batches)."""

    items_count: int
    parent_operation_id: str
    sub_batch_index: int
    total_sub_batches: int
    # Set only when this child processes a single document (see the parent's note).
    document_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization, omitting document_id when unset."""
        data = asdict(self)
        if data.get("document_id") is None:
            data.pop("document_id", None)
        return data


@dataclass
class KnowledgeIngestParentMetadata:
    """Metadata for the parent operation of an async knowledge ingest (always a parent, even for one child).

    Same keys the raw dict it replaced carried, so operations written before still read the same."""

    document_ids: list[str]
    num_sub_batches: int

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)


@dataclass
class KnowledgeIngestChildMetadata:
    """Metadata for one child operation of an async knowledge ingest: a slice of the parent's documents.

    ``parent_operation_id``/``sub_batch_index``/``total_sub_batches`` are the keys a batch retain's
    children carry, which the parent's completion check reads for both."""

    parent_operation_id: str
    sub_batch_index: int
    total_sub_batches: int
    document_ids: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)


@dataclass
class RetainMetadata:
    """Metadata for regular retain operations (non-batched, deprecated async path)."""

    items_count: int

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)


@dataclass
class RetainExtractionErrors:
    """Non-fatal fact extraction failures observed inside one retain operation."""

    count: int = 0
    sample: list[str] = field(default_factory=list)

    def add(self, message: str) -> None:
        """Record one extraction error while keeping the stored sample bounded."""
        self.count += 1
        if len(self.sample) < MAX_EXTRACTION_ERROR_SAMPLES:
            self.sample.append(message[:500])

    def merge_metadata(self, metadata: Mapping[str, Any]) -> None:
        """Merge errors already present on an operation result_metadata object."""
        self.count += int(metadata.get("extraction_errors_count") or 0)

        sample = metadata.get("extraction_errors_sample") or []
        if isinstance(sample, str):
            sample = [sample]
        if isinstance(sample, list):
            for entry in sample:
                if isinstance(entry, str) and len(self.sample) < MAX_EXTRACTION_ERROR_SAMPLES:
                    self.sample.append(entry[:500])

    def to_dict(self) -> dict[str, Any]:
        """Convert to the public result_metadata field shape."""
        data: dict[str, Any] = {"extraction_errors_count": self.count}
        if self.sample:
            data["extraction_errors_sample"] = self.sample
        return data


@dataclass
class RetainOutcomeMetadata:
    """Machine-readable outcome metadata for a completed retain operation."""

    unit_ids_count: int
    extraction_errors_count: int = 0
    extraction_errors_sample: list[str] = field(default_factory=list)
    # None means "not recorded" (over the cap, or a child written before this field
    # existed). An empty list means the retain stored no units.
    memory_ids: list[str] | None = None
    memory_ids_truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization, omitting empty optional samples."""
        data: dict[str, Any] = {
            "unit_ids_count": self.unit_ids_count,
            "extraction_errors_count": self.extraction_errors_count,
        }
        if self.extraction_errors_sample:
            data["extraction_errors_sample"] = self.extraction_errors_sample[:MAX_EXTRACTION_ERROR_SAMPLES]
        if self.memory_ids is not None:
            data["memory_ids"] = self.memory_ids
        if self.memory_ids_truncated:
            data["memory_ids_truncated"] = True
        return data


def retain_outcome_from_unit_ids(
    unit_ids: list[list[str]],
    extraction_errors: RetainExtractionErrors,
) -> RetainOutcomeMetadata:
    """Outcome metadata for one retain, including ids only while the list stays small."""
    flat = [unit_id for group in unit_ids for unit_id in group]
    truncated = len(flat) > MAX_RETAIN_RESULT_MEMORY_IDS
    return RetainOutcomeMetadata(
        unit_ids_count=len(flat),
        extraction_errors_count=extraction_errors.count,
        extraction_errors_sample=extraction_errors.sample,
        memory_ids=None if truncated else flat,
        memory_ids_truncated=truncated,
    )


@dataclass
class RetainOutcomeAggregate:
    """Aggregate retain outcome metadata from child retain operations."""

    unit_ids_count: int = 0
    extraction_errors: RetainExtractionErrors = field(default_factory=RetainExtractionErrors)
    memory_ids: list[str] | None = field(default_factory=list)
    memory_ids_truncated: bool = False
    # False once any child omitted the list without saying it was truncated (a worker
    # from before memory_ids existed). The parent then omits the list too, rather
    # than publishing a partial one as if it were complete.
    _memory_ids_known: bool = field(default=True, init=False, repr=False)

    def add_metadata(self, metadata: Mapping[str, Any]) -> None:
        """Fold one child operation's result_metadata into the aggregate."""
        self.unit_ids_count += int(metadata.get("unit_ids_count") or 0)
        self.extraction_errors.merge_metadata(metadata)
        if not self._memory_ids_known:
            return
        if metadata.get("memory_ids_truncated"):
            self._forget_memory_ids(truncated=True)
            return
        ids = metadata.get("memory_ids", _MISSING)
        if ids is _MISSING or not isinstance(ids, list):
            self._forget_memory_ids(truncated=False)
            return
        assert self.memory_ids is not None
        self.memory_ids.extend(str(item) for item in ids)
        if len(self.memory_ids) > MAX_RETAIN_RESULT_MEMORY_IDS:
            self._forget_memory_ids(truncated=True)

    def _forget_memory_ids(self, *, truncated: bool) -> None:
        self._memory_ids_known = False
        self.memory_ids = None
        if truncated:
            self.memory_ids_truncated = True

    def to_outcome_metadata(self) -> RetainOutcomeMetadata:
        """Return the aggregate in the public result_metadata field shape."""
        return RetainOutcomeMetadata(
            unit_ids_count=self.unit_ids_count,
            extraction_errors_count=self.extraction_errors.count,
            extraction_errors_sample=self.extraction_errors.sample,
            memory_ids=self.memory_ids if self._memory_ids_known else None,
            memory_ids_truncated=self.memory_ids_truncated,
        )


def reflect_result_payload(
    data: Mapping[str, Any],
    *,
    include_based_on: bool,
    include_trace: bool,
) -> dict[str, Any]:
    """The public reflect body stored on an async reflect operation.

    Matches the MCP reflect tool: ``based_on`` and the trace fields are omitted
    unless the caller asked for them. The stored object is what a finished
    reflect returns, so the short wait and a later poll share one shape.
    """
    payload = dict(data)
    if not include_based_on:
        payload.pop("based_on", None)
    if not include_trace:
        for key in _REFLECT_TRACE_FIELDS:
            payload.pop(key, None)
    return payload


@dataclass
class ConsolidationMetadata:
    """Metadata for consolidation operations."""

    # Currently empty, but structure for future fields
    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)


@dataclass
class RefreshMentalModelMetadata:
    """Metadata for mental model refresh operations."""

    mental_model_id: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)


@dataclass
class RefreshMentalModelOutcomeMetadata:
    """Machine-readable outcome metadata for a completed refresh_mental_model operation.

    Refresh parity with RetainOutcomeMetadata (#2605): lets a monitoring layer
    distinguish "refreshed with real content" from "refreshed empty" by reading
    result_metadata alone, without a follow-up content fetch.
    """

    content_len: int
    populated_content: bool
    based_on_counts: dict[str, int] = field(default_factory=dict)
    # Delta operations the model emitted, as applied vs rejected. A refresh whose
    # ops are routinely rejected still completes successfully with a plausible
    # document, so the count is the only signal that some of this run's new facts
    # never reached it. Both are 0 for a full-mode refresh, which emits no ops.
    delta_ops_applied: int = 0
    delta_ops_skipped: int = 0
    # What the refresh did with the document (#3274). Without it the operation
    # record — the only per-refresh row kept indefinitely — cannot tell a full
    # rewrite from a delta edit from a run that changed nothing: all three write
    # zero delta ops, and a preserved document reports the length of the content
    # it preserved, so ``content_len``/``populated_content`` read identically.
    # Absent (rather than null) on rows written by a build predating the field,
    # so "not recorded" stays distinguishable from any recorded value.
    outcome: "RefreshOperationOutcome | None" = None
    # Why the refresh refused to write, on the failing outcomes only. Finer than
    # ``outcome``: it is the same value persisted as ``reflect_response.refresh_skipped``.
    failure_reason: "RefreshFailureReason | None" = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization, omitting an unrecorded outcome.

        ``outcome`` is dropped when unset rather than written as null: the metadata
        is merged into whatever the operation already carries, and a null would
        overwrite a recorded value with "unknown".

        ``failure_reason`` is the opposite — it is written as null when unset, and
        must be. A refresh is retried on the SAME operation row, so an attempt that
        failed leaves its reason behind; merging a success over it without clearing
        the reason produced the nonsense pairing ``outcome=content_written`` with
        ``failure_reason=no_answer``. This writer only ever runs on a refresh that
        finished, so "no reason" is a fact about it, not a gap.
        """
        data = asdict(self)
        if data.get("outcome") is None:
            data.pop("outcome", None)
        return data


@dataclass
class RefreshMentalModelFailureMetadata:
    """Outcome metadata for a refresh that failed without writing content.

    The success-path writer derives its fields from the stored document, which a
    failed refresh never updates — so failures get their own, narrower record.
    Before this existed the reason a refresh failed survived only as prose inside
    ``error_message`` and in the model's ``reflect_response``, which the next
    refresh overwrites (#3274).
    """

    outcome: "RefreshOperationOutcome"
    failure_reason: "RefreshFailureReason"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return asdict(self)
