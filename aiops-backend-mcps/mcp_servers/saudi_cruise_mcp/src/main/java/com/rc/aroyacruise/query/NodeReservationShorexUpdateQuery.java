package com.rc.aroyacruise.query;


import com.rc.aroyacruise.dto.request.NodeReservationShorexRequest;
import com.rc.aroyacruise.dto.request.NodeReservationShorexUpdateRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeReservationShorexUpdateQuery implements AroyaQuery {

    private static final String DEFAULT_BOOK_MODE = "PRE_BOOK_ONLY";

    private final NodeReservationShorexUpdateRequest request;

    public NodeReservationShorexUpdateQuery(
            NodeReservationShorexUpdateRequest request
    ) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ReservationShorexUpdate($input: ReservationShorexUpdateInput!) {
                  reservationShorexUpdate(input: $input) {
                    operationResult
                    clientMutationId
                    result {
                      keys
                      key
                      id
                      guid
                      alphaNumId
                      name
                      termsConfirmed
                      allowInvoicing
                      groupGUID
                      initialDate
                      originalInitialDate
                      altResId
                      altGrouping
                      probability
                      manualProbability
                      sourceCode
                      officeLocation
                      contactGUID
                      currencyRate
                      ownership
                      shoppingComments
                      mode
                      commissionFreezeMode
                      onTerms
                      termsEnabledMode
                      FPRMode
                      boardingZone
                      hasExternalComponents
                      considerPaid
                      invoicesPerGuest
                      version
                      lastUpdated
                      holdUpdatesToAirSystem
                      addressGuestAs
                      excludeFromGroupAutoDistribution
                      confirmationDate
                      guestCount
                      voyagesCount
                      invoiceTotals {
                        invoiceTotal
                        payments
                        refunds
                        invoicePaid
                        hasTransactionsInProgress
                        chargeTotal
                        grandTotal
                        commissionTotal
                        comTotal
                        commissionPaid
                        comPaid
                        commissionDue
                        grossDue
                        grossDueClient
                        netDue
                        overpayment
                        overpaidCommission
                        grossUp
                        paidInFull
                        pendingPayments
                        pendingRefunds
                        pendingCommission
                        currentDueAmount
                        currentDueDate
                        currentDueType
                      }
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
                        dateTimeRange {
                          from
                          to
                        }
                        pkg {
                          key
                          code
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
        input.put("replaceAll", request.replaceAll());
        input.put(
                "shorex",
                request.shorex()
                        .stream()
                        .map(this::toShorexVariables)
                        .toList()
        );

        return Map.of("input", input);
    }

    private Map<String, Object> toShorexVariables(
            NodeReservationShorexRequest shorexRequest
    ) {
        Map<String, Object> shorex = new LinkedHashMap<>();

        shorex.put(
                "pkg",
                Map.of("key", shorexRequest.packageKey())
        );
        shorex.put("guests", shorexRequest.guests());
        shorex.put(
                "bookMode",
                defaultBookMode(shorexRequest.bookMode())
        );

        return shorex;
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }

    private String defaultBookMode(String bookMode) {
        if (bookMode == null || bookMode.isBlank()) {
            return DEFAULT_BOOK_MODE;
        }

        return bookMode.trim().toUpperCase();
    }
}
