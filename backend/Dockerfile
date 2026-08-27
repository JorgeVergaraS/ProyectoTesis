FROM maven:3.9.16-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -B -ntp package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S nexo && adduser -S nexo -G nexo
WORKDIR /app
COPY --from=build --chown=nexo:nexo /workspace/target/nexo-backend-0.0.1-SNAPSHOT.jar app.jar
USER nexo
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
