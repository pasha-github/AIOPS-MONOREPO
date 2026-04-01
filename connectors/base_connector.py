"""
Base Connector Module
---------------------
Provides the abstract BaseConnector class that all pre-built connectors must extend.
Each connector extends BaseConnector and exposes its tools to an LlmAgent.
"""

import base64
import inspect

import requests
from google.adk.tools.function_tool import FunctionTool


def connector_tool(func):
    """Marks a method as a registered tool.
    This decorator is used to mark methods as tools that can be called by the LLM.
    """
    func._is_tool = True
    return func


class BaseConnector:
    """BaseConnector class that all pre-built connectors must extend."""

    def __new__(cls, *args, **kwargs):
        if cls is BaseConnector:
            raise TypeError(
                "BaseConnector is an abstract base class and cannot be instantiated directly."
            )
        return super().__new__(cls)

    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self._tools: list[FunctionTool] = [
            self._make_tool(func)
            for _, func in inspect.getmembers(self, predicate=inspect.ismethod)
            if getattr(func, "_is_tool", False)
        ]

    def _make_tool(self, func, name: str | None = None) -> FunctionTool:
        _tool_name = name or f"{self.prefix}{func.__name__}"
        return FunctionTool(func=func)

    def get_tools(self) -> list[FunctionTool]:
        return self._tools

    @property
    def tool_names(self) -> list[str]:
        return [t.name for t in self._tools]

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} prefix={self.prefix!r} tools={self.tool_names}>"

    def call_api(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: dict[str, str] | None = None,
        json: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        basic_auth: tuple[str, str] | None = None,
        bearer_token: str | None = None,
    ) -> requests.Response:
        """Calls an API endpoint with optional authentication.

        Args:
            url (str): The URL of the API endpoint.
            method (str, optional): The HTTP method to use. Defaults to "GET".
            headers (Optional[Dict[str, str]], optional): The headers to include in the request. Defaults to None.
            data (Optional[Dict[str, str]], optional): The data to include in the request. Defaults to None.
            params (Optional[Dict[str, str]], optional): The query parameters to include in the request. Defaults to None.
            basic_auth (Optional[Tuple[str, str]], optional): The basic authentication credentials to include in the request. Defaults to None.
            bearer_token (Optional[str], optional): The bearer token to include in the request. Defaults to None.

        Returns:
            requests.Response: The response from the API endpoint.
        """

        if headers is None:
            headers = None

        if data is None:
            data = None

        if params is None:
            params = None

        if json is None:
            json = None

        # Basic Auth support
        if basic_auth:
            username, password = basic_auth
            credentials = f"{username}:{password}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            if headers is None:
                headers = {}
            headers["Authorization"] = f"Basic {encoded_credentials}"

        # Bearer Token support
        if bearer_token:
            if headers is None:
                headers = {}
            headers["Authorization"] = f"Bearer {bearer_token}"

        return requests.request(
            method, url, headers=headers, data=data, params=params, json=json
        )
