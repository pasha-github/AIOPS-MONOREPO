package com.rc.aroyacruise.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aroya.api")
public record AroyaApiProperties(
        String baseUrl,
        String integrationTasksPath,
        String clientId,
        String clientSecret,
        int connectTimeoutSeconds,
        int readTimeoutSeconds
) {
}
