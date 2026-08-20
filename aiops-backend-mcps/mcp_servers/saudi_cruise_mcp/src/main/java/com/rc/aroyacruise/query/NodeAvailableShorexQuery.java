package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeAvailableShorexRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeAvailableShorexQuery implements AroyaQuery {

    private static final boolean DEFAULT_MATCH_ITINERARY = true;
    private static final String DEFAULT_LOCALE = "en";
    private static final String DEFAULT_SITE = "website";

    private final NodeAvailableShorexRequest request;

    public NodeAvailableShorexQuery(NodeAvailableShorexRequest request) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                query AvailableShorex($params: AvailableShorexParams!) {
                  availableShorex(params: $params) {
                    availableShorex {
                      availability
                      description
                      name
                      priceInc
                      price
                      code
                      guestRefs
                      componentKind
                      pkg {
                        key
                        type {
                          key
                          name
                          timing
                          active
                          packageClass
                          components {
                            type
                            code
                            description
                            seqN
                          }
                          attributes {
                            code
                            name
                            type
                            comments
                          }
                        }
                        name
                        destination
                        description
                        productType {
                          key
                        }
                        typeName
                        shorexTiming
                        classifications {
                          type
                          code
                        }
                        location {
                          from {
                            name
                          }
                          to {
                            name
                          }
                        }
                        components {
                          type
                        }
                        code
                      }
                      dateTimeRange {
                        from
                        to
                      }
                      componentCategory {
                        key
                        name
                        description
                        parent {
                          key
                          kind
                          description
                          parent {
                            key
                            name
                            parent {
                              key
                            }
                          }
                        }
                        subCategories {
                          key
                          kind
                          description
                        }
                      }
                      pricePerGuest {
                        guestSeqN
                        guest {
                          seqN
                          age
                          ageCategory {
                            key
                          }
                          gender
                          client {
                            fullName
                          }
                          componentKind
                          children {
                            invoice {
                              pricePerUnit
                            }
                          }
                        }
                        price
                        priceInc
                      }
                      cms {
                        id
                        documentId
                        page_name
                        page_slug
                        createdAt
                        updatedAt
                        publishedAt
                        locale
                        shorex_code
                        localizations {
                          id
                          documentId
                          page_name
                          page_slug
                          createdAt
                          updatedAt
                          publishedAt
                          locale
                          shorex_code
                        }
                        excursions {
                          id
                          Activity {
                            id
                            shorex_code
                            short_description
                            long_description
                            name
                            port_code
                            activity_level
                            duration
                            amenties
                            notes
                            policy
                            placeholder
                            media {
                              id
                              name
                              alternativeText
                              caption
                              width
                              height
                              url
                              formats
                              createdAt
                              updatedAt
                              publishedAt
                            }
                          }
                        }
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

        params.put("reservationId", normalizeReservationId(request.reservationId()));
        params.put("matchItinerary", valueOrDefault(request.matchItinerary(), DEFAULT_MATCH_ITINERARY));
        params.put("locale", valueOrDefault(request.locale(), DEFAULT_LOCALE));
        params.put("site", valueOrDefault(request.site(), DEFAULT_SITE));

        return Map.of("params", params);
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }

    private Boolean valueOrDefault(Boolean value, Boolean defaultValue) {
        return value == null ? defaultValue : value;
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank()
                ? defaultValue
                : value;
    }
}
