package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeReservationAddonRemoveRequest;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.NodeReservationAddonRemoveQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationAddonRemoveJsonService {

    private final AroyaClientService clientService;
    private final AroyaService aroyaService;

    public JsonNode removeReservationAddonsJson(
            NodeReservationAddonRemoveRequest request,
            String bearerToken
    ) {
        String token = aroyaService.resolveToken(bearerToken);

        NodeReservationAddonRemoveQuery query =
                new NodeReservationAddonRemoveQuery(request);

        IntegrationTaskResponse<JsonNode> response =
                clientService.nodePostIntegrationTask(
                        query.query(),
                        query.variables(),
                        token,
                        new ParameterizedTypeReference<>() {
                        }
                );

        if (response.data() == null || response.data().isNull()) {
            throw new AroyaClientException(
                    "Response data not found in Aroya reservationAddonRemove response"
            );
        }

        return response.data();
    }
}