"""
IBM DataPower Connector v1.1.0
------------------------------
Connector for IBM DataPower Gateway monitoring via the REST Management Interface.
"""

import logging
from typing import Any

import httpx

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool

from google.adk.tools.tool_context import ToolContext

logger = logging.getLogger(__name__)


class DataPowerConnector(BaseConnector):
    """Pre-built connector for IBM DataPower Gateway monitoring."""

    _APPLIANCE_INFO = "/mgmt/"
    _SYSTEM_USAGE = "/mgmt/status/default/SystemUsage"
    _CPU_USAGE = "/mgmt/status/default/CPUUsage"
    _ETHERNET_STATUS = "/mgmt/status/default/EthernetInterfaceStatus"
    _MEMORY_STATUS = "/mgmt/status/default/MemoryStatus"
    _DOMAIN_STATUS = "/mgmt/status/default/DomainStatus"
    _DOMAIN_SUMMARY = "/mgmt/status/default/DomainSummary"
    _SERVICES_STATUS = "/mgmt/status/default/ServicesStatus"
    _OBJECT_STATUS = "/mgmt/status/default/ObjectStatus"
    _HTTP_CONNECTIONS = "/mgmt/status/default/HTTPConnections"
    _HTTP_TRANSACTIONS = "/mgmt/status/default/HTTPTransactions2"
    _HTTP_SERVICE_SUMMARY = "/mgmt/status/default/HTTPServiceSummary"
    _GATEWAY_TRANSACTIONS = "/mgmt/status/default/GatewayTransactions"
    _XML_FIREWALL_SUMMARY = "/mgmt/status/default/XMLFirewallServiceSummary"
    _MULTI_PROTOCOL_GATEWAY = "/mgmt/status/default/MultiProtocolGatewaySummary"
    _WEB_SERVICE_GATEWAY = "/mgmt/status/default/WSGatewaySummary"
    _MQ_MANAGER_STATUS = "/mgmt/status/default/MQManagerStatus"
    _MQ_CONNECTION_STATUS = "/mgmt/status/default/MQConnStatus"
    _FILESYSTEM_STATUS = "/mgmt/status/default/FilesystemStatus"
    _FIRMWARE_VERSION = "/mgmt/status/default/FirmwareVersion3"
    _LICENSE_STATUS = "/mgmt/status/default/LicenseStatus"
    _NETWORK_INTERFACE_STATUS = "/mgmt/status/default/NetworkInterfaceStatus"
    _IP_ADDRESS_STATUS = "/mgmt/status/default/IPAddressStatus"
    _LOG_TARGET_STATUS = "/mgmt/status/default/LogTargetStatus"
    _LOG_TARGET_CONNECTION = "/mgmt/status/default/LogTargetConnectionStatus"
    _SSL_PROXY_SUMMARY = "/mgmt/status/default/SSLProxyServiceSummary"
    _TCP_PROXY_SUMMARY = "/mgmt/status/default/TCPProxyServiceSummary"
    _DATE_TIME_STATUS = "/mgmt/status/default/DateTimeStatus"
    _DNS_CACHE_STATUS = "/mgmt/status/default/DNSCacheHostStatus4"
    _CRYPTO_ENGINE_STATUS = "/mgmt/status/default/CryptoEngineStatus2"
    _CRYPTO_MODE_STATUS = "/mgmt/status/default/CryptoModeStatus"
    _TEMPERATURE_SENSORS = "/mgmt/status/default/TemperatureSensors"
    _POWER_SENSORS = "/mgmt/status/default/PowerSensors"
    _CURRENT_SENSORS = "/mgmt/status/default/CurrentSensors"
    _RAID_ARRAY_STATUS = "/mgmt/status/default/RaidArrayStatus"
    _BATTERY_STATUS = "/mgmt/status/default/Battery"
    _ACTIVE_USERS = "/mgmt/status/default/ActiveUsers"

    def __init__(
        self,
        BASE_URL: str,
        USERNAME: str,
        PASSWORD: str,
        VERIFY_SSL: str = "false",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.base_url = BASE_URL.strip().rstrip("/")
        self.username = USERNAME.strip()
        self.password = PASSWORD
        self.verify_ssl = str(VERIFY_SSL).strip().lower() not in {
            "false",
            "0",
            "no",
            "off",
        }

    async def _dp_get(self, endpoint: str) -> dict[str, Any]:
        url = self.base_url + endpoint
        logger.info(
            "DataPower request: endpoint=%s verify_ssl=%s", endpoint, self.verify_ssl
        )
        try:
            async with httpx.AsyncClient(
                verify=self.verify_ssl,
                auth=(self.username, self.password),
                timeout=30.0,
            ) as client:
                response = await client.get(url, headers={"Accept": "application/json"})
        except httpx.RequestError as exc:
            logger.error("DataPower request error: endpoint=%s error=%s", endpoint, exc)
            return {"status": "error", "message": f"Request failed: {exc}"}

        logger.info(
            "DataPower response: endpoint=%s status=%s", endpoint, response.status_code
        )

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

    @connector_tool
    async def appliance_info(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get appliance information from the DataPower REST management interface."""
        return await self._dp_get(self._APPLIANCE_INFO)

    @connector_tool
    async def system_usage(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get current system usage statistics from the DataPower appliance including uptime and load."""
        return await self._dp_get(self._SYSTEM_USAGE)

    @connector_tool
    async def cpu_usage(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get CPU usage statistics from the DataPower appliance."""
        return await self._dp_get(self._CPU_USAGE)

    @connector_tool
    async def memory_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get memory usage statistics from the DataPower appliance."""
        return await self._dp_get(self._MEMORY_STATUS)

    @connector_tool
    async def ethernet_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get Ethernet interface status from the DataPower appliance including link state and traffic stats."""
        return await self._dp_get(self._ETHERNET_STATUS)

    @connector_tool
    async def domain_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all domains on the DataPower appliance."""
        return await self._dp_get(self._DOMAIN_STATUS)

    @connector_tool
    async def domain_summary(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all domains configured on the DataPower appliance."""
        return await self._dp_get(self._DOMAIN_SUMMARY)

    @connector_tool
    async def services_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all services running on the DataPower appliance."""
        return await self._dp_get(self._SERVICES_STATUS)

    @connector_tool
    async def object_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all configured objects on the DataPower appliance."""
        return await self._dp_get(self._OBJECT_STATUS)

    @connector_tool
    async def http_connections(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get current HTTP connection statistics from the DataPower appliance."""
        return await self._dp_get(self._HTTP_CONNECTIONS)

    @connector_tool
    async def http_transactions(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get HTTP transaction statistics from the DataPower appliance."""
        return await self._dp_get(self._HTTP_TRANSACTIONS)

    @connector_tool
    async def http_service_summary(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all HTTP services on the DataPower appliance."""
        return await self._dp_get(self._HTTP_SERVICE_SUMMARY)

    @connector_tool
    async def gateway_transactions(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get gateway transaction statistics from the DataPower appliance."""
        return await self._dp_get(self._GATEWAY_TRANSACTIONS)

    @connector_tool
    async def xml_firewall_summary(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all XML Firewall services on the DataPower appliance."""
        return await self._dp_get(self._XML_FIREWALL_SUMMARY)

    @connector_tool
    async def multi_protocol_gateway(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all Multi-Protocol Gateway services on the DataPower appliance."""
        return await self._dp_get(self._MULTI_PROTOCOL_GATEWAY)

    @connector_tool
    async def web_service_gateway(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all Web Service Gateway services on the DataPower appliance."""
        return await self._dp_get(self._WEB_SERVICE_GATEWAY)

    @connector_tool
    async def mq_manager_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all MQ managers on the DataPower appliance."""
        return await self._dp_get(self._MQ_MANAGER_STATUS)

    @connector_tool
    async def mq_connection_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all MQ connections on the DataPower appliance."""
        return await self._dp_get(self._MQ_CONNECTION_STATUS)

    @connector_tool
    async def filesystem_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get filesystem usage statistics from the DataPower appliance."""
        return await self._dp_get(self._FILESYSTEM_STATUS)

    @connector_tool
    async def firmware_version(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the firmware version information of the DataPower appliance."""
        return await self._dp_get(self._FIRMWARE_VERSION)

    @connector_tool
    async def license_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the license status of the DataPower appliance."""
        return await self._dp_get(self._LICENSE_STATUS)

    @connector_tool
    async def network_interface_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all network interfaces on the DataPower appliance."""
        return await self._dp_get(self._NETWORK_INTERFACE_STATUS)

    @connector_tool
    async def ip_address_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the IP address configuration and status of the DataPower appliance."""
        return await self._dp_get(self._IP_ADDRESS_STATUS)

    @connector_tool
    async def log_target_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the status of all log targets configured on the DataPower appliance."""
        return await self._dp_get(self._LOG_TARGET_STATUS)

    @connector_tool
    async def log_target_connection(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the connection status of all log targets on the DataPower appliance."""
        return await self._dp_get(self._LOG_TARGET_CONNECTION)

    @connector_tool
    async def ssl_proxy_summary(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all SSL Proxy services on the DataPower appliance."""
        return await self._dp_get(self._SSL_PROXY_SUMMARY)

    @connector_tool
    async def tcp_proxy_summary(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get a summary of all TCP Proxy services on the DataPower appliance."""
        return await self._dp_get(self._TCP_PROXY_SUMMARY)

    @connector_tool
    async def date_time_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the current date and time status of the DataPower appliance."""
        return await self._dp_get(self._DATE_TIME_STATUS)

    @connector_tool
    async def dns_cache_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the DNS cache host status from the DataPower appliance."""
        return await self._dp_get(self._DNS_CACHE_STATUS)

    @connector_tool
    async def crypto_engine_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the crypto engine status from the DataPower appliance."""
        return await self._dp_get(self._CRYPTO_ENGINE_STATUS)

    @connector_tool
    async def crypto_mode_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the crypto mode status from the DataPower appliance."""
        return await self._dp_get(self._CRYPTO_MODE_STATUS)

    @connector_tool
    async def temperature_sensors(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get temperature sensor readings from the DataPower appliance."""
        return await self._dp_get(self._TEMPERATURE_SENSORS)

    @connector_tool
    async def power_sensors(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get power sensor readings from the DataPower appliance."""
        return await self._dp_get(self._POWER_SENSORS)

    @connector_tool
    async def current_sensors(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get current sensor readings from the DataPower appliance."""
        return await self._dp_get(self._CURRENT_SENSORS)

    @connector_tool
    async def raid_array_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the RAID array status from the DataPower appliance."""
        return await self._dp_get(self._RAID_ARRAY_STATUS)

    @connector_tool
    async def battery_status(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the battery status from the DataPower appliance."""
        return await self._dp_get(self._BATTERY_STATUS)

    @connector_tool
    async def active_users(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get the list of currently active users on the DataPower appliance."""
        return await self._dp_get(self._ACTIVE_USERS)
