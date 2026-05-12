from sqlalchemy import text

from database.database import session_scope

def save_activity_text(activity_id: str, conversation_id: str, message_text: str) -> None:
    activity_key = (activity_id or "").strip()
    conversation_key = (conversation_id or "").strip()
    text_value = (message_text or "").strip()
    if not activity_key or not text_value:
        return
    with session_scope() as session:
        session.execute(
            text(
                """
                INSERT INTO activity_messages (activity_id, conversation_id, text_value)
                VALUES (:activity_id, :conversation_id, :text_value)
                ON CONFLICT(activity_id) DO UPDATE SET
                    conversation_id = excluded.conversation_id,
                    text_value = excluded.text_value
                """
            ),
            {
                "activity_id": activity_key,
                "conversation_id": conversation_key,
                "text_value": text_value,
            },
        )


def fetch_activity_text(activity_id: str) -> str:
    activity_key = (activity_id or "").strip()
    if not activity_key:
        return ""
    with session_scope() as session:
        row = session.execute(
            text(
                """
                SELECT text_value
                FROM activity_messages
                WHERE activity_id = :activity_id
                LIMIT 1
                """
            ),
            {"activity_id": activity_key},
        ).first()
    if not row:
        return ""
    return str(row[0] or "").strip()
