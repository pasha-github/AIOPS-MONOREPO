package com.rc.aroyacruise.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aroya.node-api")
public record AroyaNodeApiProperties(
        String graphqlUrl,
        int connectTimeoutSeconds,
        int readTimeoutSeconds
) {
}