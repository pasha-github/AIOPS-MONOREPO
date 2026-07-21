import argparse

from database import SessionLocal
from mcp.server.fastmcp import FastMCP
from refund_service import (
    RefundNotFoundError,
    approve_refund_request,
    reject_refund_request,
)

mcp = FastMCP(
    "Meridian Airways Refunds",
    host="0.0.0.0",
    port=8001,
    streamable_http_path="/mcp",
    sse_path="/sse",
    message_path="/messages/",
)


@mcp.tool()
def approve_refund(refund_id: int, comments: str = "") -> dict:
    """Approve a refund request in Meridian Airways"""
    db = SessionLocal()
    try:
        return approve_refund_request(db, refund_id, comments)
    except RefundNotFoundError as exc:
        raise ValueError(str(exc)) from exc
    finally:
        db.close()


@mcp.tool()
def reject_refund(refund_id: int, comments: str) -> dict:
    """Reject a refund request in Meridian Airways."""
    db = SessionLocal()
    try:
        return reject_refund_request(db, refund_id, comments)
    except RefundNotFoundError as exc:
        raise ValueError(str(exc)) from exc
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Meridian Airways Refunds MCP server."
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "streamable-http"],
        default="streamable-http",
        help="MCP transport to use. Defaults to streamable-http.",
    )
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for SSE or Streamable HTTP."
    )
    parser.add_argument(
        "--port", type=int, default=8001, help="Port for SSE or Streamable HTTP."
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    mcp.settings.host = args.host
    mcp.settings.port = args.port
    mcp.run(transport=args.transport)
