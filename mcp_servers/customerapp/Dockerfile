# Stage 1 — Build
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app
COPY build.gradle settings.gradle gradlew ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN ./gradlew clean bootJar -x test


# Stage 2 — Runtime (No Agent)
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]