package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeAvailableAddonsRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.mapper.NodeAvailableAddonsMarkdownMapper;
import com.rc.aroyacruise.query.NodeAvailableAddonsQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class NodeAroyaAddonService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final AroyaService aroyaService;
    private final NodeAvailableAddonsMarkdownMapper markdownMapper;

    public String getAvailableAddons(
            NodeAvailableAddonsRequest request,
            String bearerToken
    ) {
        NodeAvailableAddonsQuery query =
                new NodeAvailableAddonsQuery(request);

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        String token = resolveToken(bearerToken);

        JsonNode response = restClient.post()
                .uri(properties.graphqlUrl())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new AroyaClientException(
                    "Empty response received from Aroya availableAddons API"
            );
        }

        JsonNode graphQlErrors = response.get("errors");

        if (graphQlErrors != null
                && graphQlErrors.isArray()
                && !graphQlErrors.isEmpty()) {
            throw new AroyaClientException(
                    "Aroya availableAddons API returned errors: " + graphQlErrors
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            throw new AroyaClientException(
                    "Response data not found in Aroya availableAddons response"
            );
        }

        JsonNode availableAddons = data.get("availableAddons");

        if (availableAddons == null || availableAddons.isNull()) {
            throw new AroyaClientException(
                    "availableAddons result not found in Aroya response"
            );
        }

        JsonNode availableAddonsErrors = availableAddons.path("errors");

        if (availableAddonsErrors.isArray()
                && !availableAddonsErrors.isEmpty()) {
            throw new AroyaClientException(
                    "Aroya availableAddons returned errors: " + availableAddonsErrors
            );
        }

        return markdownMapper.toMarkdown(data);
    }

    private String resolveToken(String bearerToken) {
        if (StringUtils.hasText(bearerToken)) {
            return stripBearerPrefix(bearerToken);
        }

        return aroyaService.resolveToken(null);
    }

    private String stripBearerPrefix(String token) {
        return token.startsWith("Bearer ")
                ? token.substring(7)
                : token;
    }
}