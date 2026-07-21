package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeAddGuestsRequest;
import com.rc.aroyacruise.dto.request.NodeGuestRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.NodeAddGuestsQuery;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class NodeAroyaGuestService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final NodeGuestSessionStore guestSessionStore;

    public JsonNode addGuests(NodeAddGuestsRequest request) {
        NodeAddGuestsQuery query = new NodeAddGuestsQuery(request);

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        RestClient.RequestBodySpec spec = restClient.post()
                .uri(properties.graphqlUrl())
                .header(
                        HttpHeaders.CONTENT_TYPE,
                        MediaType.APPLICATION_JSON_VALUE
                )
                .header("client_channel", "web")
                .header("client_realtime", "true");

        JsonNode response = spec
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new AroyaClientException(
                    "Empty response received from Aroya node GraphQL API"
            );
        }

        JsonNode errors = response.get("errors");

        if (errors != null && !errors.isNull()) {
            throw new AroyaClientException(
                    "Aroya node GraphQL API returned errors: " + errors
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            throw new AroyaClientException(
                    "Response data not found in Aroya node GraphQL response"
            );
        }

        JsonNode guestResults = data.get("processGuestIdentity");

        if (guestResults == null || guestResults.isNull()) {
            throw new AroyaClientException(
                    "Guest identity results not found in Aroya response"
            );
        }

        saveGuestDetails(request, guestResults);

        return Utility.removeNulls(data);
    }

    private void saveGuestDetails(
            NodeAddGuestsRequest request,
            JsonNode guestResults
    ) {
        if (!guestResults.isArray()) {
            return;
        }

        for (int i = 0; i < guestResults.size(); i++) {
            JsonNode result = guestResults.get(i);

            if (result == null || result.isNull()) {
                continue;
            }

            String clientId = result.path("clientId").asText(null);
            String status = result.path("status").asText(null);

            if (!"Success".equalsIgnoreCase(status)) {
                continue;
            }

            if (i >= request.guests().size()) {
                continue;
            }

            NodeGuestRequest guestRequest = request.guests().get(i);

            guestSessionStore.save(
                    clientId,
                    guestRequest
            );
        }
    }
}
