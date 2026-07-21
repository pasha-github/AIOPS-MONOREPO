package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeCreateReservationRequest;
import com.rc.aroyacruise.dto.request.NodeReservationGuestRequest;
import com.rc.aroyacruise.dto.request.NodeReservationVoyageRequest;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class NodeCreateReservationQuery implements AroyaQuery {

    private static final String CURRENCY = "SAR";
    private static final String SOURCE_CODE = "NEWINT-CON";
    private static final String DEFAULT_AVAILABILITY = "OK";

    private final NodeCreateReservationRequest request;

    public NodeCreateReservationQuery(
            NodeCreateReservationRequest request
    ) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ReservationCreate($input: ReservationCreateInput!) {
                  reservationCreate(input: $input) {
                    errors {
                      message
                      severity
                    }
                    result {
                      key
                      id
                      guid
                      type {
                        key
                      }
                      initialDate
                      status {
                        name
                      }
                      invoiceTotals {
                        invoiceTotal
                        payments
                        currentDue {
                          date
                          amount
                          type
                          actionCode
                        }
                        invoiceTotalPrices {
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
                        paymentsPrices {
                          total
                          discount
                          quoteTotal
                          quoteDiscount
                        }
                      }
                      sourceCode
                      version
                      lastUpdated
                      guests {
                        seqN
                        age
                        ageCategory {
                          key
                        }
                        client {
                          key
                          fullName
                          gender
                        }
                      }
                      guestCount
                      paymentSchedule {
                        dueType
                        dueDate
                        expirationDate
                        amount
                        designatedPaymentCode
                        paid
                        paidAmount
                        manualFundsDistribution
                        prices {
                          total
                          discount
                          quoteTotal
                          quoteDiscount
                        }
                      }
                      promotions {
                        description
                        name
                        reference
                        componentKind
                        promotion {
                          key
                          type
                          group
                          code
                          name
                          extRules
                          comment
                          active
                          classifications {
                            keys
                          }
                        }
                        mode
                      }
                      addons {
                        price
                        quantity
                        mandatory
                        addon {
                          key
                          category {
                            key
                          }
                          type {
                            key
                          }
                          name
                          active
                          classifications {
                            code
                          }
                        }
                        guest {
                          seqN
                        }
                      }
                    }
                    rawErrors
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        Map<String, Object> reservation = new LinkedHashMap<>();

        reservation.put(
                "currency",
                Map.of("key", CURRENCY)
        );

        reservation.put(
                "guests",
                request.guests()
                        .stream()
                        .map(this::toGuestVariables)
                        .toList()
        );

        reservation.put("sourceCode", SOURCE_CODE);

        reservation.put(
                "voyages",
                request.voyages()
                        .stream()
                        .map(this::toVoyageVariables)
                        .toList()
        );

        return Map.of(
                "input",
                Map.of(
                        "reservation",
                        reservation
                )
        );
    }

    private Map<String, Object> toGuestVariables(
            NodeReservationGuestRequest guest
    ) {
        return Map.of(
                "clientId", normalizeClientId(guest.clientId()),
                "seqN", guest.seqN()
        );
    }

    private Map<String, Object> toVoyageVariables(
            NodeReservationVoyageRequest voyage
    ) {
        Map<String, Object> values = new LinkedHashMap<>();

        values.put(
                "pkg",
                Map.of("key", voyage.packageKey())
        );

        values.put("guests", voyage.guests());

        values.put(
                "category",
                Map.of("key", voyage.categoryKey())
        );

        values.put("cabinSeqN", voyage.cabinSeqN());

        values.put(
                "availability",
                normalizeAvailability(voyage.availability())
        );

        return values;
    }

    private String normalizeClientId(String clientId) {
        String value = clientId.trim();

        if (value.startsWith("Client|")) {
            return value;
        }

        return "Client|" + value;
    }

    private String normalizeAvailability(String availability) {
        if (availability == null || availability.isBlank()) {
            return DEFAULT_AVAILABILITY;
        }

        return availability.trim().toUpperCase();
    }
}
