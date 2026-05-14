# DateTime Connector

Returns the current time for a configured timezone, with optional per-call override.

## Configuration

- `TIMEZONE` (optional, default: `UTC`)

## Tool

- `get_current_time`
  - Optional argument: `timezone` (IANA timezone like `Asia/Karachi`)
  - Uses connector default timezone when omitted
