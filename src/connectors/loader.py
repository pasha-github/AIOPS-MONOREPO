import ast
import importlib.util
import inspect
import json
import sys
from functools import lru_cache
from importlib.machinery import ModuleSpec
from pathlib import Path
from typing import Any

from src.database.models import ConnectorConfig

CONNECTORS_DIR = Path(__file__).parent.parent / "connectors"


def get_connector_dir(connector_id: str) -> Path:
    return (CONNECTORS_DIR / connector_id).resolve()


def get_connector_module_path(connector_id: str) -> Path:
    return get_connector_dir(connector_id) / "connector.py"


def get_connector_metadata_path(connector_id: str) -> Path:
    return get_connector_dir(connector_id) / "metadata.json"


def get_connector_readme_path(connector_id: str) -> Path:
    return get_connector_dir(connector_id) / "README.md"


def load_connector_metadata(connector_id: str) -> dict[str, Any]:
    metadata_path = get_connector_metadata_path(connector_id)
    if not metadata_path.is_file():
        raise FileNotFoundError(
            f"Connector metadata not found. Expected file: {metadata_path}"
        )

    with metadata_path.open(encoding="utf-8") as f:
        return json.load(f)


def load_connector_documentation(connector_id: str) -> str:
    readme_path = get_connector_readme_path(connector_id)
    if not readme_path.is_file():
        raise FileNotFoundError(
            f"Connector documentation not found. Expected file: {readme_path}"
        )

    return readme_path.read_text(encoding="utf-8").strip()


def load_connector_info(connector_id: str) -> dict[str, Any]:
    metadata = load_connector_metadata(connector_id)
    return {
        "documentation": load_connector_documentation(connector_id),
        "tools": metadata.get("tools", []),
        "config_variables": metadata.get("config_variables", []),
    }


def resolve_connector_tools(connector_config: ConnectorConfig):
    """Dynamically imports a connector by connector_id and instantiates it with config values.

    Args:
        connector_config: A ConnectorConfig instance containing:
            - connector_id: maps to a .py file in the connectors/ folder (e.g. "example_connector")
            - config: list of {"name": str, "value": str} dicts used as constructor kwargs

    Returns:
        An instantiated connector object (subclass of BaseConnector) with its tools ready.

    Raises:
        FileNotFoundError: If no matching .py file exists in the connectors/ folder.
        ValueError: If the module contains no BaseConnector subclass.
    """
    connector_id = connector_config.connector_id
    config = connector_config.config

    # --- 1. Locate the connector module file ---
    module_path = get_connector_module_path(connector_id)
    if not module_path.is_file():
        raise FileNotFoundError(
            f"Connector '{connector_id}' not found. Expected file: {module_path}"
        )

    # --- 2. Dynamically import the module ---
    # Add connectors dir to sys.path so relative imports (e.g. base_connector) resolve
    connectors_abs = str(CONNECTORS_DIR.resolve())
    if connectors_abs not in sys.path:
        sys.path.insert(0, connectors_abs)

    spec: ModuleSpec | None = importlib.util.spec_from_file_location(
        connector_id, module_path
    )
    if spec is None:
        raise ValueError(f"Could not load module '{connector_id}'.")
    module = importlib.util.module_from_spec(spec)
    if spec.loader is None:
        raise ValueError(f"Could not load module '{connector_id}'.")
    spec.loader.exec_module(module)

    # --- 3. Find the BaseConnector subclass in the module ---
    from base_connector import BaseConnector

    connector_class = None
    for _, obj in inspect.getmembers(module, inspect.isclass):
        if (
            issubclass(obj, BaseConnector)
            and obj is not BaseConnector
            and obj.__module__ == connector_id
        ):
            connector_class = obj
            break

    if connector_class is None:
        raise ValueError(f"No BaseConnector subclass found in '{connector_id}.py'.")

    # --- 4. Convert config list → kwargs dict and instantiate ---
    # config format: [{"name": "API_KEY", "value": "abc123"}, ...]
    kwargs = {item["name"]: item["value"] for item in config}
    connector = connector_class(**kwargs)

    return connector.get_tools()


@lru_cache(maxsize=128)
def cached_connector_info(source: str, mtime: float):
    # your AST parsing logic here
    tree = ast.parse(source)

    # -----------------------------
    # Module-level documentation
    # -----------------------------
    module_doc = ast.get_docstring(tree) or ""

    tools: list[dict[str, str]] = []
    config_vars: list[dict[str, Any]] = []

    # -----------------------------
    # Find connector class
    # -----------------------------
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            # Ensure class inherits from BaseConnector
            is_connector = any(
                (isinstance(base, ast.Name) and base.id == "BaseConnector")
                or (isinstance(base, ast.Attribute) and base.attr == "BaseConnector")
                for base in node.bases
            )

            if not is_connector:
                continue

            # -----------------------------------
            # Inspect methods inside the class
            # -----------------------------------
            for item in node.body:
                if not isinstance(item, ast.FunctionDef):
                    continue

                # -------- CONFIG VARIABLES --------
                if item.name == "__init__":
                    args = item.args.args[1:]  # skip 'self'
                    defaults = item.args.defaults or []

                    total_args = len(args)
                    total_defaults = len(defaults)
                    first_default_index = total_args - total_defaults

                    for index, arg in enumerate(args):
                        is_required = index < first_default_index

                        config_vars.append({"name": arg.arg, "required": is_required})

                # -------- TOOLS --------
                else:
                    # Detect @connector_tool decorator
                    has_decorator = False
                    for dec in item.decorator_list:
                        if (
                            isinstance(dec, ast.Name) and dec.id == "connector_tool"
                        ) or (
                            isinstance(dec, ast.Attribute)
                            and dec.attr == "connector_tool"
                        ):
                            has_decorator = True

                    if not has_decorator:
                        continue

                    doc = ast.get_docstring(item) or ""

                    # Remove Args and Returns sections
                    cleaned_lines = []
                    for line in doc.splitlines():
                        stripped = line.strip().lower()
                        if stripped.startswith("args"):
                            break
                        if stripped.startswith("returns"):
                            break
                        cleaned_lines.append(line)

                    cleaned_doc = "\n".join(cleaned_lines).strip()

                    tools.append({"name": item.name, "documentation": cleaned_doc})

    return {
        "documentation": module_doc.strip(),
        "tools": tools,
        "config_variables": config_vars,
    }
