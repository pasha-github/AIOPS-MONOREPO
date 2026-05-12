#!/bin/bash
set -e

# Start Datadog agent using built-in init
/init &

sleep 5

# Start Spring Boot
exec java -jar /app/app.jar