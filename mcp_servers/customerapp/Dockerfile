# Stage 1 — Build app
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle
RUN chmod +x gradlew

COPY src ./src
RUN ./gradlew clean bootJar -x test


# Stage 2 — Use Datadog official agent as base
FROM gcr.io/datadoghq/agent:7

USER root
WORKDIR /app

# Install Java runtime inside agent image
RUN apt-get update && apt-get install -y openjdk-21-jre-headless

# Copy jar
COPY --from=builder /app/build/libs/*.jar /app/app.jar

# Copy custom startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh
COPY datadog /etc/datadog-agent
ENV DD_SITE=us5.datadoghq.com
ENV DD_SERVICE=status-app
ENV DD_ENV=local
ENV DD_LOGS_ENABLED=true
ENV DD_HOSTNAME=status-app

EXPOSE 8080

CMD ["/start.sh"]