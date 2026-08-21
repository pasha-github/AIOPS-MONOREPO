package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeReservationStoreRequest;
import com.rc.aroyacruise.query.NodeReservationStoreQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationStoreService {

    private final AroyaClientService clientService;
    private final AroyaService aroyaService;

    public JsonNode storeReservation(
            NodeReservationStoreRequest request
    ) {
        String token = aroyaService.resolveToken(null);
        NodeReservationStoreQuery query =  new NodeReservationStoreQuery(request);
        IntegrationTaskResponse<JsonNode> response =
                clientService.nodePostIntegrationTask(
                        query.query(),
                        query.variables(),
                        token,
                        new ParameterizedTypeReference<>() {
                        }
                );

        return response.data();

    }
}