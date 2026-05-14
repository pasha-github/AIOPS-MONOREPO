# ---------- Build stage ----------
FROM gradle:8.14.3-jdk21 AS build
WORKDIR /app

COPY . .

RUN gradle clean bootJar -x test --no-daemon

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

ENV SERVER_PORT=9095

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-$SERVER_PORT} -jar app.jar"]