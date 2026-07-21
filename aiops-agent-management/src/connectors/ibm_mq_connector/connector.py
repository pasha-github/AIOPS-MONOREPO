"""
IBM MQ Connector v0.1.0
-----------------------
Connector for IBM MQ administrative operations and support endpoints.
Provides queue manager discovery, MQSC execution, MQ log retrieval,
and SSH command execution via Paramiko or a bridge endpoint.
"""

import logging
from typing import Any
from urllib.parse import urlsplit

import paramiko
import requests
from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext

logger = logging.getLogger(__name__)


class IbmMqConnector(BaseConnector):
    """
    Pre-built connector for IBM MQ administration workflows.

    Tools exposed:
        dspmq
        runmqsc
        get_mq_logs
        run_commands_ssh
    """

    def __init__(
        self,
        URL_BASE: str,
        USER_NAME: str,
        PASSWORD: str,
        LOGS_URL: str,
        SSH_HOSTNAME: str,
        SSH_USERNAME: str,
        SSH_PASSWORD: str,
        SSH_URL: str = "",
        VERIFY_TLS: str = "false",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.url_base = URL_BASE.rstrip("/") + "/"
        self.username = USER_NAME
        self.password = PASSWORD
        self.logs_url = LOGS_URL.strip()
        self.ssh_hostname = SSH_HOSTNAME.strip()
        self.ssh_username = SSH_USERNAME.strip()
        self.ssh_password = SSH_PASSWORD
        self.ssh_url = SSH_URL.strip()
        self.verify_tls = self._parse_bool(VERIFY_TLS)

    def _parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    def _mq_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "ibm-mq-rest-csrf-token": "token",
        }

    def _request(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        json_data: dict[str, Any] | None = None,
        timeout: float = 30.0,
        basic_auth: bool = False,
    ) -> requests.Response:
        auth = (self.username, self.password) if basic_auth else None
        safe_url = urlsplit(url)
        logger.info(
            "IBM MQ connector request: method=%s host=%s path=%s basic_auth=%s",
            method,
            safe_url.netloc,
            safe_url.path,
            basic_auth,
        )
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=json_data,
            auth=auth,
            timeout=timeout,
            verify=self.verify_tls,
        )
        logger.info(
            "IBM MQ connector response: method=%s host=%s path=%s status=%s",
            method,
            safe_url.netloc,
            safe_url.path,
            response.status_code,
        )
        return response

    def _error_result(
        self, message: str, response: requests.Response | None = None
    ) -> dict[str, Any]:
        result: dict[str, Any] = {"status": "error", "message": message}
        if response is not None:
            result["code"] = response.status_code
            body = response.text.strip()
            if body:
                result["details"] = body
        return result

    def _perform_mq_request(
        self,
        endpoint: str,
        method: str = "GET",
        json_data: dict[str, Any] | None = None,
        timeout: float = 30.0,
    ) -> dict[str, Any]:
        url = f"{self.url_base}{endpoint.lstrip('/')}"
        try:
            response = self._request(
                url=url,
                method=method,
                headers=self._mq_headers(),
                json_data=json_data,
                timeout=timeout,
                basic_auth=True,
            )
        except requests.RequestException as exc:
            return {"status": "error", "message": f"MQ request failed: {exc}"}

        if response.status_code >= 400:
            return self._error_result("MQ request failed", response)

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return self._error_result("MQ endpoint did not return valid JSON", response)

    def _format_queue_managers(self, payload: dict[str, Any]) -> list[dict[str, str]]:
        queue_managers = []
        for item in payload.get("qmgr", []):
            queue_managers.append(
                {
                    "name": str(item.get("name", "")),
                    "running": str(item.get("state", "")),
                }
            )
        return queue_managers

    def _format_mqsc_response(self, payload: dict[str, Any]) -> list[str]:
        formatted_lines: list[str] = []

        for command_response in payload.get("commandResponse", []):
            text_lines = list(command_response.get("text", []))
            if not text_lines:
                continue

            if text_lines[0].startswith("CSQN205I"):
                trimmed = text_lines[1:-1]
                for line in trimmed:
                    formatted_lines.append(line[15:] if len(line) > 15 else line)
            else:
                formatted_lines.append(text_lines[0])

        return formatted_lines

    def _format_logs(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {
                "status": "success",
                "data": payload,
            }

        errors = payload.get("errors", [])
        return {
            "status": "success",
            "log_status": payload.get("status", "UNKNOWN"),
            "message": payload.get("message", ""),
            "detected_issues": errors if isinstance(errors, list) else [errors],
        }

    def _format_ssh_response(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {
                "status": "success",
                "data": payload,
            }

        return {
            "status": "success",
            "output": payload.get("output", ""),
            "error": payload.get("error", ""),
        }

    @connector_tool
    def dspmq(self, tool_context: ToolContext | None = None) -> dict[str, Any]:
        """Lists queue managers available to the configured mqweb server and reports whether each one is running."""
        logger.info("IBM MQ tool called: dspmq")
        result = self._perform_mq_request("qmgr/")
        if result["status"] != "success":
            return result

        queue_managers = self._format_queue_managers(result["data"])
        return {
            "status": "success",
            "count": len(queue_managers),
            "queue_managers": queue_managers,
        }

    @connector_tool
    def runmqsc(
        self,
        qmgr_name: str,
        mqsc_command: str,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Runs an MQSC command against a specific queue manager and returns normalized command output."""
        logger.info("IBM MQ tool called: runmqsc qmgr_name=%s", qmgr_name)
        result = self._perform_mq_request(
            endpoint=f"action/qmgr/{qmgr_name}/mqsc",
            method="POST",
            json_data={
                "type": "runCommand",
                "parameters": {"command": mqsc_command},
            },
        )
        if result["status"] != "success":
            return result

        output_lines = self._format_mqsc_response(result["data"])
        return {
            "status": "success",
            "qmgr_name": qmgr_name,
            "mqsc_command": mqsc_command,
            "output_lines": output_lines,
            "output": "\n".join(output_lines),
        }

    @connector_tool
    def get_mq_logs(self, tool_context: ToolContext | None = None) -> dict[str, Any]:
        """Fetches IBM MQ log status and any detected issues such as channel failures or connectivity problems."""
        logger.info(
            "IBM MQ tool called: get_mq_logs configured=%s", bool(self.logs_url)
        )
        if not self.logs_url:
            return {"status": "error", "message": "LOGS_URL is not configured."}

        try:
            response = self._request(url=self.logs_url, timeout=30.0)
        except requests.RequestException as exc:
            return {"status": "error", "message": f"Failed to fetch MQ logs: {exc}"}

        if response.status_code >= 400:
            return self._error_result("Failed to fetch MQ logs", response)

        try:
            payload = response.json()
        except ValueError:
            return self._error_result(
                "Logs endpoint did not return valid JSON", response
            )

        return self._format_logs(payload)

    @connector_tool
    def run_commands_ssh(
        self,
        command: str,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Runs a command over configured SSH access and returns stdout/stderr."""
        logger.info(
            "IBM MQ tool called: run_commands_ssh ssh_url=%s ssh_hostname=%s",
            bool(self.ssh_url),
            bool(self.ssh_hostname),
        )
        if self.ssh_url:
            try:
                response = self._request(
                    url=self.ssh_url,
                    method="POST",
                    json_data={"command": command},
                    timeout=60.0,
                )
            except requests.RequestException as exc:
                return {
                    "status": "error",
                    "message": f"Failed to run SSH command: {exc}",
                }

            if response.status_code >= 400:
                return self._error_result("Failed to run SSH command", response)

            try:
                payload = response.json()
            except ValueError:
                return self._error_result(
                    "SSH endpoint did not return valid JSON", response
                )

            return self._format_ssh_response(payload)

        if not self.ssh_hostname:
            return {"status": "error", "message": "SSH_HOSTNAME is not configured."}
        if not self.ssh_username:
            return {"status": "error", "message": "SSH_USERNAME is not configured."}
        if self.ssh_password is None or self.ssh_password == "":
            return {"status": "error", "message": "SSH_PASSWORD is not configured."}

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=self.ssh_hostname,
                username=self.ssh_username,
                password=self.ssh_password,
                timeout=10,
            )
            _stdin, stdout, stderr = client.exec_command(f"sudo -u mqm {command}")
            output = stdout.read().decode()
            error = stderr.read().decode()
            return {"status": "success", "output": output, "error": error}
        except Exception as exc:
            return {"status": "error", "message": f"Failed to run SSH command: {exc}"}
        finally:
            client.close()
