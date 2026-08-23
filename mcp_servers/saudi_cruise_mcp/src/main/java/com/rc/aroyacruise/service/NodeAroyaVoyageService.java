package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeAvailableVoyagesRequest;
import com.rc.aroyacruise.mapper.NodeAvailableVoyagesMarkdownMapper;
import com.rc.aroyacruise.query.NodeAvailableVoyageByKeyQuery;
import com.rc.aroyacruise.query.NodeAvailableVoyagesQuery;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaVoyageService {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;

    private static final String VOYAGES_NOT_AVAILABLE_MESSAGE =
            "voyages of that dates and destionation not available please try another date";

    private final AroyaClientService clientService;
    private final AroyaService aroyaService;
    private final NodeAvailableVoyagesMarkdownMapper availableVoyagesMarkdownMapper;

    public JsonNode getAvailableVoyages(
            NodeAvailableVoyagesRequest request
    ) {
        String token = aroyaService.resolveToken(null);

        NodeAvailableVoyagesQuery query =
                new NodeAvailableVoyagesQuery(request);

        IntegrationTaskResponse<JsonNode> response =
                clientService.nodePostIntegrationTask(
                        query.query(),
                        query.variables(),
                        token,
                        new ParameterizedTypeReference<>() {
                        }
                );

        JsonNode data = response.data();

        if (data == null || data.isNull()) {
            return voyagesNotAvailableResponse(request);
        }

        JsonNode results = data
                .path("availableVoyages")
                .path("results");

        if (!results.isArray() || results.size() == 0) {
            return voyagesNotAvailableResponse(request);
        }

        return Utility.removeNulls(data);
    }
    public String getAvailableVoyagesMD(NodeAvailableVoyagesRequest request){
        JsonNode response = getAvailableVoyages(
                request
                );

        return availableVoyagesMarkdownMapper.toMarkdown(response);
    }

    public JsonNode getAvailableVoyageByPackageKey(
            String packageKey
    ) {
        String token = aroyaService.resolveToken(null);

        NodeAvailableVoyageByKeyQuery query =
                new NodeAvailableVoyageByKeyQuery(packageKey);

        IntegrationTaskResponse<JsonNode> response =
                clientService.nodePostIntegrationTask(
                        query.query(),
                        query.variables(),
                        token,
                        new ParameterizedTypeReference<>() {
                        }
                );

        JsonNode data = response.data();

        if (data == null || data.isNull()) {
            return availableVoyageNotFoundResponse(packageKey);
        }

        JsonNode availableVoyage = data.get("availableVoyage");

        if (availableVoyage == null || availableVoyage.isNull()) {
            return availableVoyageNotFoundResponse(packageKey);
        }

        return Utility.removeNulls(data);
    }

    private JsonNode voyagesNotAvailableResponse(
            NodeAvailableVoyagesRequest request
    ) {
        ObjectNode response = JSON.objectNode();

        response.put("success", false);
        response.put("message", VOYAGES_NOT_AVAILABLE_MESSAGE);

        ObjectNode searchCriteria = JSON.objectNode();

        searchCriteria.put("startDateFrom", request.startDateFrom());
        searchCriteria.put("startDateTo", request.startDateTo());
        searchCriteria.set("destinations", JSON.pojoNode(request.destinations()));
        searchCriteria.set("departurePorts", JSON.pojoNode(request.departurePorts()));

        response.set("searchCriteria", searchCriteria);

        return response;
    }

    private JsonNode availableVoyageNotFoundResponse(
            String packageKey
    ) {
        ObjectNode response = JSON.objectNode();

        response.put("success", false);
        response.put(
                "message",
                "Voyage is not available for packageKey: " + packageKey
        );

        return response;
    }
}