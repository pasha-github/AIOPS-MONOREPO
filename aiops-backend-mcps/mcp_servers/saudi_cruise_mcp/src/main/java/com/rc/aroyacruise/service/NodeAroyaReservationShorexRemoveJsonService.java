package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeReservationShorexRemoveRequest;
import com.rc.aroyacruise.query.NodeReservationShorexRemoveQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationShorexRemoveJsonService {

    private final AroyaClientService clientService;
    private final AroyaService aroyaService;

    public JsonNode removeReservationShorexJson(
            NodeReservationShorexRemoveRequest request,
            String bearerToken
    ) {
        String token = aroyaService.resolveToken(bearerToken);

        NodeReservationShorexRemoveQuery query =
                new NodeReservationShorexRemoveQuery(request);

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
