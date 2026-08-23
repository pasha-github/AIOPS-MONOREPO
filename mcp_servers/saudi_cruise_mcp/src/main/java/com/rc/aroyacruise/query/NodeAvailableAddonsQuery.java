package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeAvailableAddonsRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeAvailableAddonsQuery implements AroyaQuery {

    private final NodeAvailableAddonsRequest request;

    public NodeAvailableAddonsQuery(NodeAvailableAddonsRequest request) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                query AvailableAddons($params: AvailableAddonsParams!) {
                  availableAddons(params: $params) {
                    availableAddons {
                      price
                      addon {
                        key
                        name
                        category {
                          key
                        }
                        type {
                          key
                        }
                        classifications {
                          code
                        }
                        couponClass
                      }
                      dateTimeRange {
                        from
                        to
                      }
                      components {
                        pkg {
                          key
                        }
                        category {
                          key
                        }
                        reference
                      }
                      mandatory
                      guests {
                        guest {
                          seqN
                          age
                        }
                        price
                      }
                    }
                    errors {
                      message
                      group
                      severity
                      code
                      source
                      classification
                    }
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        Map<String, Object> params = new LinkedHashMap<>();

        params.put("withMandatory", valueOrDefault(request.withMandatory(), false));
        params.put("withClassification", valueOrDefault(request.withClassification(), false));
        params.put("reservationId", normalizeReservationId(request.reservationId()));

        return Map.of("params", params);
    }

    private Boolean valueOrDefault(Boolean value, Boolean defaultValue) {
        return value == null ? defaultValue : value;
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }
}
