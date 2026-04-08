# Creating an Agent Management Kit Connector

This guide explains how developers can create new Connectors within the Agent Management Kit. Connectors expose dynamic external APIs as AI-ready "tools" that LLM Agents can natively interact with.

## 1. File Naming Rules

To be automatically discovered by the `routers/connectors.py` API:
* **Directory**: Place your file inside the `/connectors` directory.
* **Filename**: The filename **MUST end with** `_connector.py`.
    * Example: `slack_connector.py`, `salesforce_connector.py`.
* The router will automatically parse the prefix (e.g., `slack`) and expose your connector in the UI as "Slack".

## 2. Structural Requirements

Every connector must subclass the abstract `BaseConnector` class and correctly load its tools using the defined class decorators. 

### Basic Template

```python
from typing import Any, Dict, Optional
from google.adk.tools.tool_context import ToolContext
from base_connector import BaseConnector, connector_tool

class ExampleConnector(BaseConnector):
    """
    Module level documentation explaining what the connector does.
    This documentation is extracted by the UI/Platform.
    """

    def __init__(self, API_KEY: str, BASE_URL: str = "https://api.example.com", prefix: str = ""):
        # SUPER INIT MUST BE CALLED
        super().__init__(prefix=prefix)
        self.api_key = API_KEY
        self.base_url = BASE_URL.rstrip('/')

    @connector_tool
    def example_tool(self, item_id: str, tool_context: Optional[ToolContext] = None) -> Dict[str, Any]:
        """Description of the tool goes here for the LLM to understand.

        Args:
            item_id: The ID of the item to fetch.
        """
        response = self.call_api(
            url=f"{self.base_url}/items/{item_id}",
            method="GET",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return {"status": "success", "data": response.json()}
```

## 3. Configuration & Constructor

The UI platform automatically parses the connector's `__init__` constructor using Python's AST (Abstract Syntax Tree) to dynamically build configuration forms for the user! 
*(See `utils/helper.py` cached_connector_info).*

* **Define connection parameters directly in `__init__` arguments.**
* **Required variables**: Any argument without a default value is considered `required` by the UI.
* **Optional variables**: Any argument with a default value (e.g., `BASE_URL: str = "https://api.com"`) is treated as optional in the configuration interface.
* **Capitalization Convention**: Standardize on using `UPPER_CASE` or `Title_Case` configurations so they look neat in the UI.

## 4. Building Tools for the LLM

* **Use the `@connector_tool` decorator**: Only methods marked with this decorator are compiled into the LLM's tool context array.
* **Type hinting**: Strictly use Python type hints to define exact expectations for variables (arguments and return dicts).
* **Docstrings are critical**: 
    * The first lines of the method's docstring are parsed and given to the AI so it knows **how and when to use the tool**.
    * The parser system (`utils/helper.py`) ignores everything after the `Args:` or `Returns:` headers, so place LLM instructions at the very top of the docstring.

## 5. API Calling Helper

`BaseConnector` exposes a helpful `call_api()` method built on top of the requests library:

```python
self.call_api(
    url="...",
    method="GET",  # or POST, PUT, PATCH, DELETE
    headers={"Accept": "application/json"},
    data={"key": "value"},  # For JSON payloads
    params={"limit": 10},   # For URL Query Parameters
    basic_auth=("username", "password"),
    bearer_token="eyJhbGc..."
)
```

## 6. Creating an API Wrapper

For most APIs, it is highly recommended to create an internal helper method (e.g., `_make_request`) that wraps `self.call_api`. This allows you to centralize error handling, handle API authentication seamlessly, and ensure JSON serialization behaves as expected across all tools.

### Example Wrapper

```python
    def _make_request(self, endpoint: str, method: str = "GET", params: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Helper method to make API requests and handle common authentication/status errors."""
        url = f"{self.base_url}{endpoint}"
        
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}" # centralized auth
        }
        
        # Call the BaseConnector API function
        response = self.call_api(
            url=url,
            method=method,
            headers=headers,
            params=params, # Optional URL Params
            data=data      # Optional Body
        )
        
        # Centralized Error Handling 
        if response.status_code == 401:
            return {"status": "error", "code": 401, "message": "Authentication failed. Token may be invalid or expired."}
            
        elif response.status_code >= 400:
             return {"status": "error", "code": response.status_code, "message": response.text}
             
        try:
             # Strip standard boilerplate from response
            return {"status": "success", "data": response.json().get('result', response.json())}
        except ValueError:
            return {"status": "success", "data": response.text}
```

**Note:** Always handle your REST status codes explicitly! The Agent uses your return dict (e.g., `{"status": "error", "code": 401}`) to determine if its Action succeeded and if it needs to attempt a retry. By centralizing this in a `_make_request` method, you ensure resilient behaviors for all LLM interactions.
