package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeAvailableVoyagesRequest;

import java.util.List;
import java.util.Map;

public class NodeAvailableVoyagesQuery implements AroyaQuery {

    private static final String SITE = "website";
    private static final String LOCALE = "en";

    private final NodeAvailableVoyagesRequest request;

    public NodeAvailableVoyagesQuery(NodeAvailableVoyagesRequest request) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
            query AvailableVoyages($params: AvailableVoyagesParams!) {
              availableVoyages(params: $params) {
                results {
                  pkg {
                    key
                    type {
                      cms {
                        title
                        duration
                        pkg_media
                        map_image {
                          url
                        }
                        description
                      }
                    }
                  }
                  availableCategories {
                    capacity
                    description
                    price {
                      currency {
                        key
                        id
                      }
                      total
                      pricePerGuest {
                        total
                        discount
                        quoteTotal
                      }
                      discount
                      quoteTotal
                      quoteDiscount
                    }
                  }
                  sailActivities {
                    itineraryTitle
                    itineraryDescription
                    type {
                      key
                      comments
                    }
                    dateTime
                  }
                }
              }
            }
            """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of(
                "params", Map.of(
                        "site", SITE,
                        "locale", LOCALE,
                        "offset", request.offset() != null ? request.offset() : 0,
                        "limit", request.limit() != null ? request.limit() : 10,
                        "startDateRange", Map.of(
                                "from", request.startDateFrom(),
                                "to", request.startDateTo()
                        ),
                        "destinations", toKeyObjects(request.destinations()),
                        "departurePorts", toKeyObjects(request.departurePorts())
                )
        );
    }

    private List<Map<String, String>> toKeyObjects(List<String> values) {
        if (values == null) {
            return List.of();
        }

        return values.stream()
                .map(value -> Map.of("key", value))
                .toList();
    }
}