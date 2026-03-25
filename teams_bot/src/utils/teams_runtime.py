from collections.abc import Awaitable, Callable
from typing import Any

from microsoft_teams.api import ApiClient
from microsoft_teams.api.clients.user.params import GetUserTokenParams
from microsoft_teams.api.clients.user.token_client import UserTokenClient

from utils.helpers import normalize_service_url

_original_get_user_token: Callable[..., Awaitable[Any]] | None = None
_original_api_client_init: Callable[..., None] | None = None


def disable_user_token_lookup() -> None:
    """
    Disable SDK user-token lookup on every incoming activity.

    This suppresses Bot Framework `GetToken` calls (for example `connectionName=graph`)
    when Graph/OAuth user tokens are not used by this app.
    """
    global _original_get_user_token
    if _original_get_user_token is not None:
        return

    _original_get_user_token = UserTokenClient.get

    async def _disabled_get_user_token(
        self: UserTokenClient, params: GetUserTokenParams
    ) -> Any:
        raise RuntimeError(
            "User token lookup is disabled. Configure OAuth connection and remove this patch if needed."
        )

    UserTokenClient.get = _disabled_get_user_token


def normalize_api_client_service_urls() -> None:
    """
    Strip trailing slashes from service URLs before SDK clients append `/v3/...`.

    Teams activities in this environment provide service URLs ending with `/`.
    The current SDK joins paths with string concatenation, which turns those
    values into `...//v3/...` requests and yields `502 Bad Gateway` responses.
    """

    global _original_api_client_init
    if _original_api_client_init is not None:
        return

    _original_api_client_init = ApiClient.__init__

    def _normalized_api_client_init(
        self: ApiClient, service_url: str, *args: Any, **kwargs: Any
    ) -> None:
        assert _original_api_client_init is not None
        _original_api_client_init(
            self, normalize_service_url(service_url), *args, **kwargs
        )

    ApiClient.__init__ = _normalized_api_client_init
