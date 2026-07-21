from sqlalchemy.orm import Session

import models


class RefundNotFoundError(ValueError):
    pass


def approve_refund_request(db: Session, refund_id: int, comments: str = "") -> dict:
    refund = db.query(models.RefundRequest).filter(models.RefundRequest.id == refund_id).first()
    if not refund:
        raise RefundNotFoundError("Refund request not found")

    refund.status = "Approved"
    refund.supervisor_comments = comments

    db.add(models.AuditLog(
        agent_name="Supervisor",
        action="Manual Approval",
        decision="Approved",
        inputs=f"Refund ID: {refund_id}",
        outputs=f"Comments: {comments}",
        booking_id=refund.booking_id
    ))
    db.commit()
    return {"message": "Approved"}


def reject_refund_request(db: Session, refund_id: int, comments: str) -> dict:
    refund = db.query(models.RefundRequest).filter(models.RefundRequest.id == refund_id).first()
    if not refund:
        raise RefundNotFoundError("Refund request not found")

    refund.status = "Rejected"
    refund.supervisor_comments = comments

    db.add(models.AuditLog(
        agent_name="Supervisor",
        action="Manual Rejection",
        decision="Rejected",
        inputs=f"Refund ID: {refund_id}",
        outputs=f"Comments: {comments}",
        booking_id=refund.booking_id
    ))
    db.commit()
    return {"message": "Rejected"}
