import logging
import sys
from importlib import import_module
from uuid import uuid4

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)

BedrockAgentCoreApp = import_module("bedrock_agentcore.runtime").BedrockAgentCoreApp
agent_module = import_module("src.agent_runtime.bedrock_agentcore.agent")
DEFAULT_USER_ID = agent_module.DEFAULT_USER_ID
create_session = agent_module.create_session
delete_session = agent_module.delete_session
get_session = agent_module.get_session
list_sessions = agent_module.list_sessions
run_agent = agent_module.run_agent

app = BedrockAgentCoreApp()


@app.entrypoint
async def agent_invocation(payload: dict, context):
    logger.info("New AgentCore invocation received")
    logger.info("Context session_id: %s", getattr(context, "session_id", None))
    logger.info("Payload keys: %s", sorted(payload.keys()))

    action = payload.get("action")
    if action:
        user_id = payload.get("user_id") or DEFAULT_USER_ID
        session_id = payload.get("session_id")
        try:
            if action == "create_session":
                session = await create_session(user_id=user_id, session_id=session_id)
                returned_session_id = session.get("id")
                if not isinstance(returned_session_id, str) or not returned_session_id:
                    return {"error": "session creation did not return a session id"}
                response = {"session": session, "session_id": returned_session_id}
                logger.info(
                    "AgentCore action response: action=%s session_id=%s",
                    action,
                    returned_session_id,
                )
                return response
            if action == "list_sessions":
                sessions = await list_sessions(user_id=user_id)
                logger.info(
                    "AgentCore action response: action=%s session_count=%s",
                    action,
                    len(sessions),
                )
                return {"sessions": sessions}
            if action == "get_session":
                if not user_id or not session_id:
                    return {"error": "missing user_id or session_id"}
                session = await get_session(user_id=user_id, session_id=session_id)
                logger.info(
                    "AgentCore action response: action=%s session_id=%s found=%s",
                    action,
                    session_id,
                    session is not None,
                )
                return {"session": session, "session_id": session_id}
            if action == "delete_session":
                if not user_id or not session_id:
                    return {"error": "missing user_id or session_id"}
                await delete_session(user_id=user_id, session_id=session_id)
                logger.info(
                    "AgentCore action response: action=%s session_id=%s",
                    action,
                    session_id,
                )
                return {"ok": True, "session_id": session_id}
            return {"error": f"unsupported action '{action}'"}
        except Exception as exc:
            logger.exception("AgentCore session action failed")
            return {"error": str(exc), "session_id": session_id}

    prompt = payload.get("prompt") or payload.get("message")
    if not prompt:
        return {"error": "missing prompt in payload"}

    user_id = payload.get("user_id") or DEFAULT_USER_ID
    force_new = payload.get("new_session", False)
    session_id = (
        str(uuid4())
        if force_new
        else payload.get("session_id")
        or getattr(context, "session_id", None)
        or "default-session"
    )

    try:
        logger.info(
            "AgentCore prompt invocation: user_id=%s session_id=%s prompt_chars=%s",
            user_id,
            session_id,
            len(prompt),
        )
        result = await run_agent(
            prompt=prompt,
            user_id=user_id,
            session_id=session_id,
        )
        logger.info(
            "AgentCore prompt response: user_id=%s session_id=%s result_chars=%s",
            user_id,
            session_id,
            len(result),
        )
        return {"result": result, "session_id": session_id}
    except Exception as exc:
        logger.exception("AgentCore invocation failed")
        return {"error": str(exc), "session_id": session_id}


if __name__ == "__main__":
    logger.info("Starting BedrockAgentCoreApp server on port 8080")
    app.run()
