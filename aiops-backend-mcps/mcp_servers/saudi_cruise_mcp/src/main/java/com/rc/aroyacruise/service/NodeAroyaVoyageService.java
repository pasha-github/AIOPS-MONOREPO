package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeAvailableVoyagesRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.service.NodeVoyageResponseHelper;
import com.rc.aroyacruise.query.NodeAvailableVoyageByKeyQuery;
import com.rc.aroyacruise.query.NodeAvailableVoyagesQuery;
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
public class NodeAroyaVoyageService {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final int MAX_AVAILABLE_VOYAGES = 3;
    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final NodeVoyageResponseHelper responseHelper;

    public JsonNode getAvailableVoyages(
            NodeAvailableVoyagesRequest request
    ) {
        NodeAvailableVoyagesQuery query =
                new NodeAvailableVoyagesQuery(request);

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
            return limitFirstThreeAvailableVoyages(
                    responseHelper.mockAvailableVoyagesResponse(
                            request,
                            "Aroya availableVoyages response is null"
                    )
            );
        }

        if (responseHelper.hasGraphQlErrors(response)) {
            throw new AroyaClientException(
                    "Aroya node GraphQL API returned errors: "
                            + response.get("errors")
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            return limitFirstThreeAvailableVoyages(
                    responseHelper.mockAvailableVoyagesResponse(
                            request,
                            "Aroya availableVoyages response data is missing"
                    )
            );
        }

        if (!responseHelper.hasAvailableVoyagesCmsData(data)) {
            return limitFirstThreeAvailableVoyages(
                    responseHelper.mockAvailableVoyagesResponse(
                            request,
                            "Aroya availableVoyages CMS data is missing"
                    )
            );
        }

        return Utility.removeNulls(
                limitFirstThreeAvailableVoyages(data)
        );
    }
    public JsonNode getAvailableVoyageByPackageKey(
            String packageKey
    ) {
        NodeAvailableVoyageByKeyQuery query =
                new NodeAvailableVoyageByKeyQuery(packageKey);

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
                .header("client_channel", "web")
                .header("client_realtime", "true")
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            return responseHelper.mockAvailableVoyageByPackageKeyResponse(
                    packageKey,
                    "Aroya availableVoyage response is null"
            );
        }

        if (responseHelper.hasGraphQlErrors(response)) {
            throw new AroyaClientException(
                    "Aroya availableVoyage API returned errors: "
                            + response.get("errors")
            );
        }

        JsonNode data = response.get("data");

        if (data == null || data.isNull()) {
            return responseHelper.mockAvailableVoyageByPackageKeyResponse(
                    packageKey,
                    "Aroya availableVoyage response data is missing"
            );
        }

        JsonNode availableVoyage = data.get("availableVoyage");

        if (availableVoyage == null || availableVoyage.isNull()) {
            return responseHelper.mockAvailableVoyageByPackageKeyResponse(
                    packageKey,
                    "availableVoyage result not found for packageKey: "
                            + packageKey
            );
        }

        if (!responseHelper.hasAvailableVoyageCmsData(data)) {
            return responseHelper.mockAvailableVoyageByPackageKeyResponse(
                    packageKey,
                    "Aroya availableVoyage CMS data is missing for packageKey: "
                            + packageKey
            );
        }

        return Utility.removeNulls(data);
    }

private JsonNode limitFirstThreeAvailableVoyages(JsonNode data) {
    if (!(data.deepCopy() instanceof ObjectNode dataObject)) {
        return data;
    }

    JsonNode availableVoyagesNode =
            dataObject.path("availableVoyages");

    if (!(availableVoyagesNode instanceof ObjectNode availableVoyagesObject)) {
        return dataObject;
    }

    JsonNode resultsNode =
            availableVoyagesObject.path("results");

    if (!resultsNode.isArray()) {
        return dataObject;
    }

    ArrayNode limitedResults = JSON.arrayNode();

    int count = 0;

    for (JsonNode result : resultsNode) {
        if (count >= MAX_AVAILABLE_VOYAGES) {
            break;
        }

        limitedResults.add(result.deepCopy());
        count++;
    }

    availableVoyagesObject.set("results", limitedResults);

    return dataObject;
}
}