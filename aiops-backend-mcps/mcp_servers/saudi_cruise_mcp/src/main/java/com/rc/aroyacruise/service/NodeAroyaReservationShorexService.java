package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeReservationShorexUpdateRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.NodeReservationShorexUpdateQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationShorexService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final AroyaService aroyaService;

    public JsonNode updateReservationShorex(
            NodeReservationShorexUpdateRequest request,
            String bearerToken
    ) {
        NodeReservationShorexUpdateQuery query =
                new NodeReservationShorexUpdateQuery(request);

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        String token = aroyaService.resolveToken(bearerToken);

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
                    "Empty response received from Aroya reservationShorexUpdate API"
            );
        }

        return response;
    }
}
