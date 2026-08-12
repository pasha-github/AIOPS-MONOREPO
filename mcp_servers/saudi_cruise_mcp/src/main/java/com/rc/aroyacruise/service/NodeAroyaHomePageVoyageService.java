package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.NodeHomePageVoyagesQuery;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class NodeAroyaHomePageVoyageService {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final int MAX_VOYAGES_PER_DESTINATION = 3;

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;

    public JsonNode getHomePageVoyages(
    ) {
        NodeHomePageVoyagesQuery query =
                new NodeHomePageVoyagesQuery();

        Map<String, Object> body = Map.of(
                "query", query.query(),
                "variables", query.variables()
        );

        JsonNode response = restClient.post()
                .uri(properties.graphqlUrl())
                .header(
                        HttpHeaders.CONTENT_TYPE,
                        MediaType.APPLICATION_JSON_VALUE
                )
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            throw new AroyaClientException(
                    "Empty response received from Aroya BFF homePageVoyages API"
            );
        }

        JsonNode errors = response.get("errors");

        if (errors != null && errors.isArray() && !errors.isEmpty()) {
            throw new AroyaClientException(
                    "Aroya BFF homePageVoyages API returned errors: " + errors
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            throw new AroyaClientException(
                    "Response data not found in Aroya BFF homePageVoyages response"
            );
        }

        return Utility.removeNulls(
                limitVoyagesPerDestination(data)
        );
    }

    private JsonNode limitVoyagesPerDestination(JsonNode data) {
        if (!(data.deepCopy() instanceof ObjectNode dataObject)) {
            return data;
        }

        JsonNode homePageVoyagesNode =
                dataObject.path("homePageVoyages");

        if (!homePageVoyagesNode.isArray()) {
            return dataObject;
        }

        ArrayNode homePageVoyages = (ArrayNode) homePageVoyagesNode;

        for (JsonNode destinationNode : homePageVoyages) {
            if (!(destinationNode instanceof ObjectNode destinationObject)) {
                continue;
            }

            JsonNode voyagesNode = destinationObject.path("voyages");

            if (!voyagesNode.isArray()) {
                continue;
            }

            destinationObject.set(
                    "voyages",
                    firstThreeVoyages(voyagesNode)
            );
        }

        return dataObject;
    }

    private ArrayNode firstThreeVoyages(JsonNode voyagesNode) {
        ArrayNode limitedVoyages = JSON.arrayNode();

        int count = 0;

        for (JsonNode voyage : voyagesNode) {
            if (count >= MAX_VOYAGES_PER_DESTINATION) {
                break;
            }

            limitedVoyages.add(voyage.deepCopy());
            count++;
        }

        return limitedVoyages;
    }
}