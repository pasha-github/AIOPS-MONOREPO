import ast
import importlib
import inspect
import json
import logging
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from src.database.models import ConnectorConfig

CONNECTORS_DIR = Path(__file__).parent.parent / "connectors"
logger = logging.getLogger(__name__)


def _config_names(config: list[dict[str, str]]) -> list[str]:
    return [str(item.get("name", "")) for item in config]


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


def connector_module_name(connector_id: str) -> str:
    return f"connectors.{connector_id}.connector"


def ensure_connector_import_paths() -> None:
    project_src = CONNECTORS_DIR.resolve().parent
    for path in (project_src, CONNECTORS_DIR.resolve()):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


def resolve_connector_instance(connector_config: ConnectorConfig):
    """Dynamically imports a connector by connector_id and instantiates it with config values.

    Args:
        connector_config: A ConnectorConfig instance containing:
            - connector_id: maps to a .py file in the connectors/ folder (e.g. "example_connector")
            - config: list of {"name": str, "value": str} dicts used as constructor kwargs

    Returns:
        An instantiated connector object (subclass of BaseConnector).

    Raises:
        FileNotFoundError: If no matching .py file exists in the connectors/ folder.
        ValueError: If the module contains no BaseConnector subclass.
    """
    connector_id = connector_config.connector_id
    config = connector_config.config
    logger.info(
        "Resolving connector instance: connector_id=%s config_id=%s config_keys=%s",
        connector_id,
        connector_config.connector_config_id,
        _config_names(config),
    )

    # --- 1. Locate the connector module file ---
    module_path = get_connector_module_path(connector_id)
    if not module_path.is_file():
        raise FileNotFoundError(
            f"Connector '{connector_id}' not found. Expected file: {module_path}"
        )
    logger.info(
        "Connector module found: connector_id=%s path=%s", connector_id, module_path
    )

    # --- 2. Import the module by stable package name ---
    # Add src for `connectors.*` imports and connectors for legacy
    # `from base_connector import ...` imports used by connector modules.
    ensure_connector_import_paths()
    importlib.invalidate_caches()
    module_name = connector_module_name(connector_id)
    try:
        module = importlib.import_module(module_name)
    except ImportError as exc:
        raise ValueError(f"Could not load module '{module_name}'.") from exc
    logger.info(
        "Connector module imported: connector_id=%s module=%s",
        connector_id,
        module_name,
    )

    # --- 3. Find the BaseConnector subclass in the module ---
    from base_connector import BaseConnector

    connector_class = None
    for _, obj in inspect.getmembers(module, inspect.isclass):
        if (
            issubclass(obj, BaseConnector)
            and obj is not BaseConnector
            and obj.__module__ == module_name
        ):
            connector_class = obj
            break

    if connector_class is None:
        raise ValueError(f"No BaseConnector subclass found in '{connector_id}.py'.")
    logger.info(
        "Connector class selected: connector_id=%s class=%s",
        connector_id,
        connector_class.__name__,
    )

    # --- 4. Convert config list → kwargs dict and instantiate ---
    # config format: [{"name": "API_KEY", "value": "abc123"}, ...]
    kwargs = {
        item["name"]: item["value"]
        for item in config
        if item.get("value") is not None and str(item.get("value")).strip() != ""
    }
    omitted_blank_keys = sorted(
        str(item.get("name"))
        for item in config
        if item.get("value") is None or str(item.get("value")).strip() == ""
    )
    logger.info(
        "Connector kwargs prepared: connector_id=%s provided_keys=%s "
        "omitted_blank_keys=%s",
        connector_id,
        sorted(kwargs.keys()),
        omitted_blank_keys,
    )
    return connector_class(**kwargs)


def resolve_connector_tools(connector_config: ConnectorConfig):
    """Dynamically imports a connector by connector_id and returns its tools.

    Args:
        connector_config: A ConnectorConfig instance containing:
            - connector_id: maps to a .py file in the connectors/ folder (e.g. "example_connector")
            - config: list of {"name": str, "value": str} dicts used as constructor kwargs

    Returns:
        The instantiated connector's tools, ready for an agent.

    Raises:
        FileNotFoundError: If no matching .py file exists in the connectors/ folder.
        ValueError: If the module contains no BaseConnector subclass.
    """
    connector = resolve_connector_instance(connector_config)
    tools = connector.get_tools()
    logger.info(
        "Connector tools resolved: connector_id=%s class=%s tool_names=%s",
        connector_config.connector_id,
        connector.__class__.__name__,
        [getattr(tool, "name", repr(tool)) for tool in tools],
    )

    return tools


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
