package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeReservationAddonUpdateRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.NodeReservationAddonUpdateQuery;
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
public class NodeAroyaReservationAddonService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final AroyaService aroyaService;

    public JsonNode updateReservationAddons(
            NodeReservationAddonUpdateRequest request
    ) {
        NodeReservationAddonUpdateQuery query =
                new NodeReservationAddonUpdateQuery(request);

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        String token = resolveToken(null);

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
                    "Empty response received from Aroya reservationAddonUpdate API"
            );
        }

        return response;
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
