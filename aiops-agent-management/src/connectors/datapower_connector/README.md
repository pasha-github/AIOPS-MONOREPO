# IBM DataPower Connector

Connector for IBM DataPower Gateway monitoring via the REST Management Interface. Uses Basic Auth over HTTPS to query appliance status endpoints.

## Configuration

| Variable | Label | Required | Secret | Description |
|---|---|---|---|---|
| `BASE_URL` | Base URL | Yes | No | DataPower REST management base URL (e.g. `https://host:5554`) |
| `USERNAME` | Username | Yes | No | DataPower admin username |
| `PASSWORD` | Password | Yes | Yes | DataPower admin password |
| `VERIFY_SSL` | Verify SSL | No | No | Set to `false` for self-signed certificates (default: `false`) |
| `prefix` | Prefix | No | No | Optional prefix for tool names to avoid conflicts (e.g. `DataPower`) |

## Tools

### General

| Tool | Description |
|---|---|
| `appliance_info` | Get appliance information from the DataPower REST management interface |
| `system_usage` | Get current system usage statistics including uptime and load |
| `cpu_usage` | Get CPU usage statistics |
| `memory_status` | Get memory usage statistics |
| `ethernet_status` | Get Ethernet interface status including link state and traffic stats |
| `firmware_version` | Get firmware version information |
| `license_status` | Get license status |
| `date_time_status` | Get current date and time status |
| `active_users` | Get list of currently active users |

### Domains & Services

| Tool | Description |
|---|---|
| `domain_status` | Get the status of all domains |
| `domain_summary` | Get a summary of all configured domains |
| `services_status` | Get the status of all running services |
| `object_status` | Get the status of all configured objects |

### HTTP & Gateway

| Tool | Description |
|---|---|
| `http_connections` | Get current HTTP connection statistics |
| `http_transactions` | Get HTTP transaction statistics |
| `http_service_summary` | Get a summary of all HTTP services |
| `gateway_transactions` | Get gateway transaction statistics |
| `xml_firewall_summary` | Get a summary of all XML Firewall services |
| `multi_protocol_gateway` | Get a summary of all Multi-Protocol Gateway services |
| `web_service_gateway` | Get a summary of all Web Service Gateway services |
| `ssl_proxy_summary` | Get a summary of all SSL Proxy services |
| `tcp_proxy_summary` | Get a summary of all TCP Proxy services |

### MQ

| Tool | Description |
|---|---|
| `mq_manager_status` | Get the status of all MQ managers |
| `mq_connection_status` | Get the status of all MQ connections |

### Network

| Tool | Description |
|---|---|
| `network_interface_status` | Get the status of all network interfaces |
| `ip_address_status` | Get IP address configuration and status |
| `dns_cache_status` | Get DNS cache host status |

### Storage & Filesystem

| Tool | Description |
|---|---|
| `filesystem_status` | Get filesystem usage statistics |
| `raid_array_status` | Get RAID array status |

### Logging

| Tool | Description |
|---|---|
| `log_target_status` | Get the status of all configured log targets |
| `log_target_connection` | Get the connection status of all log targets |

### Crypto

| Tool | Description |
|---|---|
| `crypto_engine_status` | Get crypto engine status |
| `crypto_mode_status` | Get crypto mode status |

### Hardware Sensors

| Tool | Description |
|---|---|
| `temperature_sensors` | Get temperature sensor readings |
| `power_sensors` | Get power sensor readings |
| `current_sensors` | Get current sensor readings |
| `battery_status` | Get battery status |

## Example Prompts

- *"Get appliance info from DataPower"*
- *"What is the current CPU usage on DataPower?"*
- *"Show me the memory status of the DataPower appliance"*
- *"What domains are configured on DataPower?"*
- *"Show me the MQ manager status on DataPower"*
- *"What is the firmware version of the DataPower appliance?"*
- *"Show HTTP transaction statistics from DataPower"*
- *"Are there any active users on DataPower right now?"*
- *"What is the filesystem usage on DataPower?"*
- *"Show temperature sensor readings from DataPower"*
