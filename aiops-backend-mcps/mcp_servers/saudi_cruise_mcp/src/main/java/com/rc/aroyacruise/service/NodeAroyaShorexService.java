package com.rc.aroyacruise.service;


import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeAvailableShorexRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.mapper.NodeAvailableShorexMarkdownMapper;
import com.rc.aroyacruise.query.NodeAvailableShorexQuery;
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
public class NodeAroyaShorexService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final AroyaService aroyaService;
    private final NodeAvailableShorexMarkdownMapper markdownMapper;

    public String getAvailableShorex(
            NodeAvailableShorexRequest request,
            String bearerToken
    ) {
        NodeAvailableShorexQuery query =
                new NodeAvailableShorexQuery(request);

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        String token = resolveToken(bearerToken);

        JsonNode response = restClient.post()
                .uri(properties.graphqlUrl())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("client_channel", "web")
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new AroyaClientException(
                    "Empty response received from Aroya availableShorex API"
            );
        }

        JsonNode graphQlErrors = response.get("errors");

        if (graphQlErrors != null
                && graphQlErrors.isArray()
                && !graphQlErrors.isEmpty()) {
            throw new AroyaClientException(
                    "Aroya availableShorex API returned errors: "
                            + graphQlErrors
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            throw new AroyaClientException(
                    "Response data not found in Aroya availableShorex response"
            );
        }

        JsonNode availableShorex = data.get("availableShorex");

        if (availableShorex == null || availableShorex.isNull()) {
            throw new AroyaClientException(
                    "availableShorex result not found in Aroya response"
            );
        }

        JsonNode availableShorexErrors =
                availableShorex.path("errors");

        if (availableShorexErrors.isArray()
                && !availableShorexErrors.isEmpty()) {
            throw new AroyaClientException(
                    "Aroya availableShorex returned errors: "
                            + availableShorexErrors
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
