"""Public health bodies omit database and pool diagnostics.

Probes and anonymous callers receive only a status. The full payload, including
pool counters and exception text, is returned only to a caller that presents a
credential the process actually checks.
"""

import logging
import secrets
from typing import Any

from pydantic import BaseModel

from hindsight_api.config import get_config
from hindsight_api.extensions.builtin.tenant import DefaultTenantExtension
from hindsight_api.extensions.tenant import AuthenticationError
from hindsight_api.models import RequestContext

logger = logging.getLogger(__name__)


class PublicHealthBody(BaseModel):
    status: str
    service: str


def is_ready(health: dict[str, Any]) -> bool:
    # health_check() still returns the engine's existing dict. Only the status
    # field decides readiness; the rest stays off the public response.
    return health.get("status") == "healthy"


def public_health_body(healthy: bool, service: str) -> PublicHealthBody:
    status = "ok" if healthy else "unhealthy"
    return PublicHealthBody(status=status, service=service)


def _bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    else:
        token = authorization.strip()
    return token or None


def _matches(provided: str, expected: str) -> bool:
    return secrets.compare_digest(provided.encode(), expected.encode())


async def diagnostics_allowed(authorization: str | None, tenant_extension: Any) -> bool:
    """True when the caller presented a credential this process verifies.

    The default tenant extension accepts every request, so a bearer token there
    is not authentication. Pool stats stay hidden unless a configured MCP token
    matches, or a non-default extension accepts the credential.
    """
    token = _bearer(authorization)
    if not token:
        return False
    configured = get_config().mcp_auth_token
    if configured and _matches(token, configured):
        return True
    if tenant_extension is None or isinstance(tenant_extension, DefaultTenantExtension):
        return False
    try:
        await tenant_extension.authenticate(RequestContext(api_key=token))
    except AuthenticationError:
        return False
    except Exception:
        logger.warning("Health diagnostics authentication failed")
        return False
    return True
