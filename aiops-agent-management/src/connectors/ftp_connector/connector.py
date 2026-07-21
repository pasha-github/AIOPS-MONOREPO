"""
FTP Connector v1.0.0
List directories and read text files from an FTP server using Python's ftplib.
"""

from __future__ import annotations

import contextlib
import io
from ftplib import FTP, error_perm
from typing import Any

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class FTPConnector(BaseConnector):
    """FTP connector — list files and read text content from an FTP server."""

    def __init__(
        self,
        FTP_HOST: str,
        FTP_USERNAME: str,
        FTP_PASSWORD: str,
        FTP_PORT: str = "21",
        FTP_DIRECTORY: str = "",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.host = FTP_HOST.strip()
        self.port = int(FTP_PORT.strip()) if str(FTP_PORT).strip() else 21
        self.username = FTP_USERNAME.strip()
        self.password = FTP_PASSWORD
        self.directory = FTP_DIRECTORY.strip().strip("/")

    def _validate_config(self) -> str | None:
        if not self.host:
            return "FTP_HOST is required."
        if not self.username:
            return "FTP_USERNAME is required."
        if not self.password:
            return "FTP_PASSWORD is required."
        if not self.directory:
            return "FTP_DIRECTORY is required."
        return None

    def _connect(self) -> tuple[FTP, None] | tuple[None, dict[str, Any]]:
        """Open a fresh FTP connection and change to the configured directory."""
        try:
            ftp = FTP()
            ftp.connect(self.host, self.port, timeout=15)
            ftp.login(self.username, self.password)
            ftp.set_pasv(True)
            if self.directory:
                ftp.cwd(self.directory)
            return ftp, None
        except error_perm as exc:
            return None, {
                "status": "error",
                "code": 530,
                "message": f"FTP login failed: {exc}",
            }
        except OSError as exc:
            return None, {
                "status": "error",
                "code": 503,
                "message": f"Could not connect to FTP server {self.host}:{self.port}: {exc}",
            }

    # ── Tools ──────────────────────────────────────────────────────────────────

    @connector_tool
    def list_files(self) -> dict[str, Any]:
        """
        List files and directories on the FTP server.

        Lists from FTP_DIRECTORY if configured, otherwise from the server root.

        Returns:
            dict: List of file/directory names on the server.
        """
        err = self._validate_config()
        if err:
            return {"status": "error", "message": err}

        ftp, conn_err = self._connect()
        if conn_err is not None:
            return conn_err
        assert ftp is not None

        try:
            entries = ftp.nlst()
            directory = f"/{self.directory}" if self.directory else "/"
            return {
                "status": "success",
                "directory": directory,
                "count": len(entries),
                "files": entries,
            }
        except error_perm as exc:
            return {"status": "error", "message": f"FTP listing failed: {exc}"}
        finally:
            with contextlib.suppress(Exception):
                ftp.quit()

    @connector_tool
    def read_file(self, file_name: str) -> dict[str, Any]:
        """
        Read the content of a text file from the FTP server.

        Args:
            file_name: Name of the file to read (e.g. hello.txt).

        Returns:
            dict: File content as plain text (UTF-8).
        """
        err = self._validate_config()
        if err:
            return {"status": "error", "message": err}

        if not file_name.strip():
            return {"status": "error", "message": "file_name is required."}

        ftp, conn_err = self._connect()
        if conn_err is not None:
            return conn_err
        assert ftp is not None

        buf = io.BytesIO()
        try:
            ftp.retrbinary(f"RETR {file_name.strip()}", buf.write)
        except error_perm as exc:
            code = str(exc)[:3]
            if code == "550":
                return {
                    "status": "error",
                    "code": 404,
                    "message": f"File '{file_name}' not found on FTP server.",
                }
            return {"status": "error", "message": f"FTP error: {exc}"}
        except OSError as exc:
            return {"status": "error", "message": f"FTP transfer failed: {exc}"}
        finally:
            with contextlib.suppress(Exception):
                ftp.quit()

        raw = buf.getvalue()
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("utf-8", errors="replace")

        return {
            "status": "success",
            "file_name": file_name.strip(),
            "content": content,
            "encoding": "utf-8",
        }
