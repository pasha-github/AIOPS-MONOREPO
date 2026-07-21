import json
import os
import urllib.error
import urllib.request
from typing import Any

WEBHOOK_ENV_VAR = "REFUND_REQUEST_WEBHOOK_URL"


def _isoformat(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def build_refund_prompt(refund, booking) -> str:
    customer = booking.customer
    flight = booking.flight

    refund_data = {
        "refund_request": {
            "id": refund.id,
            "booking_id": refund.booking_id,
            "reason": refund.reason,
            "status": refund.status,
            # "refund_amount": refund.refund_amount,
            # "ai_recommendation": refund.ai_recommendation,
            # "confidence_score": refund.confidence_score,
            # "human_approval_required": refund.human_approval_required,
            "supervisor_comments": refund.supervisor_comments,
            "request_date": _isoformat(refund.request_date),
        },
        "booking": {
            "id": booking.id,
            "pnr": booking.pnr,
            "customer_id": booking.customer_id,
            "flight_id": booking.flight_id,
            "booking_date": _isoformat(booking.booking_date),
            "cabin_class": booking.cabin_class,
            "status": booking.status,
            "total_amount": booking.total_amount,
        },
        "customer": {
            "id": customer.id if customer else None,
            "first_name": customer.first_name if customer else None,
            "last_name": customer.last_name if customer else None,
            "email": customer.email if customer else None,
            "loyalty_tier": customer.loyalty_tier if customer else None,
        },
        "flight": {
            "id": flight.id if flight else None,
            "flight_number": flight.flight_number if flight else None,
            "origin": flight.origin if flight else None,
            "destination": flight.destination if flight else None,
            "departure_time": _isoformat(flight.departure_time) if flight else None,
            "arrival_time": _isoformat(flight.arrival_time) if flight else None,
            "aircraft_type": flight.aircraft_type if flight else None,
            "status": flight.status if flight else None,
            "base_price": flight.base_price if flight else None,
        },
    }

    return (
        "A Meridian Airways customer has requested a refund. "
        "Review and monitor this refund workflow using the complete refund data below.\n\n"
        f"{json.dumps(refund_data, indent=2)}"
    )


def invoke_refund_request_webhook(refund, booking, timeout: int = 10) -> dict:
    webhook_url = os.getenv(WEBHOOK_ENV_VAR)
    if not webhook_url:
        return {
            "sent": False,
            "status": "skipped",
            "reason": f"{WEBHOOK_ENV_VAR} is not configured",
        }

    payload = json.dumps({"prompt": build_refund_prompt(refund, booking)}).encode(
        "utf-8"
    )
    request = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_body = response.read(1000).decode("utf-8", errors="replace")
            return {
                "sent": True,
                "status": "sent",
                "status_code": response.status,
                "response": response_body,
            }
    except urllib.error.HTTPError as exc:
        response_body = exc.read(1000).decode("utf-8", errors="replace")
        return {
            "sent": False,
            "status": "failed",
            "status_code": exc.code,
            "reason": response_body or str(exc),
        }
    except (OSError, urllib.error.URLError) as exc:
        return {
            "sent": False,
            "status": "failed",
            "reason": str(exc),
        }
