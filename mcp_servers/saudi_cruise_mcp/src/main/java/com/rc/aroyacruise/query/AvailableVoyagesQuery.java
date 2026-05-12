package com.rc.aroyacruise.query;

import java.util.List;
import java.util.stream.Collectors;

public class AvailableVoyagesQuery implements AroyaQuery {

    private static final String CURRENCY = "USD";
    private static final String SOURCE_CODE = "INT-CON";
    private static final String ADULT_AGE_CATEGORY_ID = "AgeCategory|SHIP|ADULT";
    private static final String CHILD_AGE_CATEGORY_ID = "AgeCategory|SHIP|CHILD";

    private final String startDateFrom;
    private final String startDateTo;
    private final List<String> destinations;
    private final List<String> departurePorts;

    public AvailableVoyagesQuery(
            String startDateFrom,
            String startDateTo,
            List<String> destinations,
            List<String> departurePorts
    ) {
        this.startDateFrom = startDateFrom;
        this.startDateTo = startDateTo;
        this.destinations = destinations;
        this.departurePorts = departurePorts;
    }

    @Override
    public String query() {
        return """
                query AvailableVoyages {
                    availableVoyages(
                        params: {
                            availability: OK
                            productTypes: [{ key: "CRUISE" }]
                            reservation: {
                                currency: { key: ["%s"] }
                                sourceCode: "%s"
                                guests: [
                                    { seqN: 1, ageCategoryId: "%s" }
                                    { seqN: 2, ageCategoryId: "%s" }
                                ]
                            }
                            inactive: false
                            startDateRange: { from: "%s", to: "%s" }
                            destinations: [%s]
                            departurePorts: [%s]
                        }
                    ) {
                        pkg {
                            key
                            initialStatus
                            destination
                            season
                            comment
                            description
                            isActive
                            landDays
                            sailDays
                            typeName
                            typeComment
                            sailIdent
                            sailCode
                            active
                            type {
                                key
                                name
                                comments
                                landDays
                                sailDays
                                active
                                attributes {
                                    code
                                    name
                                    type
                                    comments
                                }
                            }
                        }
                        availableCategories {
                            cabinCategory {
                                keys
                                key
                                id
                                code
                                description
                                comments
                                cabinCapacity
                                categoryCapacity
                                rank
                            }
                            availability {
                                result
                                shipResult
                                totalCabins
                                availableCabins
                                reserved
                                availableReserved
                                totalAvailableAbsolute
                                totalAvailableWeighted
                            }
                            price {
                                currency {
                                    keys
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
                            guestDistribution {
                                cabinSeqN
                                guests
                            }
                        }
                        sail {
                            timePrecision
                            route {
                                comments
                            }
                            from {
                                dateTime
                                port {
                                    name
                                }
                            }
                            to {
                                dateTime
                                port {
                                    name
                                }
                            }
                        }
                    }
                }
                """.formatted(
                CURRENCY,
                SOURCE_CODE,
                ADULT_AGE_CATEGORY_ID,
                CHILD_AGE_CATEGORY_ID,
                escape(startDateFrom),
                escape(startDateTo),
                formatStringList(destinations),
                formatStringList(departurePorts)
        );
    }

    private String formatStringList(List<String> values) {
        return values.stream()
                .map(this::escape)
                .map(value -> "\"" + value + "\"")
                .collect(Collectors.joining(", "));
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}