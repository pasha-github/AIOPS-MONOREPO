package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeReservationStoreRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeReservationStoreQuery implements AroyaQuery {

    private static final boolean DEFAULT_UNLOCK = false;

    private final NodeReservationStoreRequest request;

    public NodeReservationStoreQuery(NodeReservationStoreRequest request) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ReservationStore($input: ReservationStoreInput!) {
                  reservationStore(input: $input) {
                    operationResult
                    clientMutationId
                    result {
                      key
                      id
                    }
                    errors {
                      severity
                      advice
                      message
                      code
                      canSave
                      onSaveOnly
                    }
                    extensions {
                      access_token
                      server_time
                      seaware_version
                    }
                    rawErrors
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        Map<String, Object> input = new LinkedHashMap<>();

        input.put("unlock", request.unlock() == null
                ? DEFAULT_UNLOCK
                : request.unlock());

        input.put("id", normalizeReservationId(request.reservationId()));

        return Map.of("input", input);
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }
}