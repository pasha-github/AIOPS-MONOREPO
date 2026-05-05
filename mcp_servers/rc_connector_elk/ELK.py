import os
import json
from fastapi import FastAPI, HTTPException, Body
from contextlib import asynccontextmanager
from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters

app = FastAPI(title="ELK MCP Connector")

# 🔥 Elasticsearch MCP Config
ELK_CONFIG = {
    "command": "npx",
    "args": ["-y", "@awesome-ai/elasticsearch-mcp"],
    "env": {
        "ES_HOST": "http://12.208.100.100:9200"
    }
}

mcp_session = None
tools_map = {}


# 🔥 Lifespan - Start MCP
@asynccontextmanager
async def lifespan(app: FastAPI):
    global mcp_session, tools_map

    server = StdioServerParameters(
        command=ELK_CONFIG["command"],
        args=ELK_CONFIG["args"],
        env={**os.environ, **ELK_CONFIG["env"]}
    )

    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:

            await session.initialize()
            tools_response = await session.list_tools()

            mcp_session = session

            for tool in tools_response.tools:
                tools_map[tool.name] = tool
                create_endpoint(tool.name, tool)

            print("✅ ELK MCP Initialized")

            yield

    print("❌ ELK MCP Closed")


# 🔥 Detect JSON fields
def is_json_field(name: str):
    name = name.lower()
    return any(x in name for x in ["body", "query", "mapping", "settings", "template"])


# 🔥 Dynamic Endpoint Creator (FINAL FIX)
def create_endpoint(tool_name, tool):

    schema = tool.inputSchema.get("properties", {})
    required_fields = tool.inputSchema.get("required", [])

    async def endpoint(payload: dict = Body(
        ...,
        example=build_example(schema)
    )):
        try:
            clean_args = {}

            for k, v in payload.items():
                if v is None:
                    continue

                # 🔥 FIX: Convert string JSON → object if needed
                if isinstance(v, str) and is_json_field(k):
                    try:
                        clean_args[k] = json.loads(v)
                    except:
                        clean_args[k] = v
                else:
                    clean_args[k] = v

            # ✅ Validate required fields
            for field in required_fields:
                if field not in clean_args or clean_args[field] == "":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing required field: {field}"
                    )

            print(f"\n🚀 TOOL CALL: {tool_name}")
            print(f"📦 CLEAN ARGS: {clean_args}")

            result = await mcp_session.call_tool(
                tool_name,
                arguments=clean_args
            )

            return {
                "tool": tool_name,
                "status": "success",
                "data": result
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    endpoint.__name__ = f"{tool_name}_endpoint"

    app.post(f"/Connector/elk/{tool_name}", tags=["ELK MCP"])(endpoint)


# 🔥 Build Swagger Example Automatically
def build_example(schema):
    example = {}

    for key, value in schema.items():
        field_type = value.get("type", "string")

        if is_json_field(key):
            # 🔥 JSON object example
            example[key] = {
                "sample": "value"
            }

        elif field_type == "string":
            example[key] = value.get("example", "string")

        elif field_type == "integer":
            example[key] = 0

        elif field_type == "number":
            example[key] = 0.0

        elif field_type == "boolean":
            example[key] = False

        else:
            example[key] = "value"

    return example


# attach lifespan
app.router.lifespan_context = lifespan