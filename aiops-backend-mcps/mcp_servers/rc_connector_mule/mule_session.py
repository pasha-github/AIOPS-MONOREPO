import time
import requests
import logging

logger = logging.getLogger("mule.session")


class MuleSession:
    def __init__(self, client_id, client_secret):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.expires_at = 0
        self.login(initial=True)

    def login(self, initial=False):
        logger.info(
            "🔐 Mule OAuth login %s",
            "(initial)" if initial else "(refresh)"
        )

        r = requests.post(
            "https://anypoint.mulesoft.com/accounts/api/v2/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret
            },
            timeout=10
        )
        r.raise_for_status()

        data = r.json()
        self.token = data["access_token"]
        expires_in = int(data.get("expires_in", 0))

        # Refresh 60s early
        self.expires_at = time.time() + expires_in - 60

        logger.info(
            "✅ Mule token %s | valid for ~%s minutes",
            "created" if initial else "refreshed",
            round(expires_in / 60, 2)
        )

    def is_expired(self):
        remaining = int(self.expires_at - time.time())

        if remaining <= 0:
            logger.warning("⏰ Mule token expired")
            return True

        logger.debug(
            "🔄 Mule token reuse | expires in %s minutes",
            round(remaining / 60, 2)
        )
        return False

    def get_token(self):
        if self.is_expired():
            self.login()
        return self.token
