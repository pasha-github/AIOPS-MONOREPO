package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeReservationShorexRemoveRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeReservationShorexRemoveQuery implements AroyaQuery {

    private final NodeReservationShorexRemoveRequest request;

    public NodeReservationShorexRemoveQuery(
            NodeReservationShorexRemoveRequest request
    ) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ReservationShorexRemove($input: ReservationShorexRemoveInput!) {
                  reservationShorexRemove(input: $input) {
                    operationResult
                    clientMutationId
                    result {
                      key
                      id
                      shorex {
                        noteSubject
                        notes
                        price
                        effectiveDate
                        description
                        name
                        reference
                        componentKind
                        recordId
                        code
                        sellLimResult
                        status
                        componentCategory {
                          key
                        }
                        guest {
                          seqN
                          age
                          client {
                            key
                            fullName
                          }
                        }
                        pkg {
                          key
                          type {
                            key
                          }
                          code
                          recordId
                          name
                          initialStatus
                          location {
                            from {
                              name
                            }
                            to {
                              name
                            }
                          }
                          comment
                          description
                          typeName
                          typeComment
                        }
                      }
                    }
                    errors {
                      message
                      severity
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

        input.put("id", normalizeReservationId(request.reservationId()));
        input.put("guests", request.guests());
        input.put(
                "pkgs",
                Map.of("key", request.packageKeys())
        );

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