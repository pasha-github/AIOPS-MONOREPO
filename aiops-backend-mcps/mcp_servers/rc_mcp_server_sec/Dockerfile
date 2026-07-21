FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jdk
WORKDIR /app
# Changed *.jar to *.war here:
COPY --from=build /app/target/*.war app.war

# Executable WARs can be run exactly like JARs
ENTRYPOINT ["java", "-jar", "app.war"]
