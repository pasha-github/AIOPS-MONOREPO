package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeReservationAddonRequest;
import com.rc.aroyacruise.dto.request.NodeReservationAddonUpdateRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeReservationAddonUpdateQuery implements AroyaQuery {

    private static final String DEFAULT_STATUS = "CONFIRMED";
    private static final int DEFAULT_QUANTITY = 1;

    private final NodeReservationAddonUpdateRequest request;

    public NodeReservationAddonUpdateQuery(
            NodeReservationAddonUpdateRequest request
    ) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation reservationAddonUpdate($input: ReservationAddonUpdateInput!) {
                  reservationAddonUpdate(input: $input) {
                    operationResult
                    clientMutationId
                    result {
                      keys
                      key
                      id
                      guid
                      alphaNumId
                      initialDate
                      version
                      lastUpdated
                      confirmationDate
                      status {
                        key
                        id
                        name
                        comment
                      }
                      addons {
                        price
                        effectiveDate
                        description
                        name
                        reference
                        recordId
                        quantity
                        mandatory
                        dateTimeRange {
                          from
                          to
                        }
                        addon {
                          key
                          id
                          name
                          useAsClientPreference
                          active
                          category {
                            key
                            id
                            comments
                          }
                        }
                      }
                      invoiceTotals {
                        invoiceTotal
                        payments
                        refunds
                        invoicePaid
                        hasTransactionsInProgress
                        grandTotal
                        commissionPaid
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

        input.put("id", normalizeReservationId(request.reservationId()));
        input.put(
                "addons",
                request.addons()
                        .stream()
                        .map(this::toAddonVariables)
                        .toList()
        );

        return Map.of("input", input);
    }

    private Map<String, Object> toAddonVariables(
            NodeReservationAddonRequest addonRequest
    ) {
        Map<String, Object> addon = new LinkedHashMap<>();

        addon.put(
                "addon",
                Map.of("id", normalizeAddonId(addonRequest.addonKey()))
        );
        addon.put(
                "status",
                defaultStatus(addonRequest.status())
        );
        addon.put(
                "date",
                Map.of(
                        "from", addonRequest.dateFrom(),
                        "to", addonRequest.dateTo()
                )
        );
        addon.put(
                "quantity",
                addonRequest.quantity() == null
                        ? DEFAULT_QUANTITY
                        : addonRequest.quantity()
        );
        addon.put("guests", addonRequest.guests());
        addon.put("linkedComponent", addonRequest.linkedComponent());

        return addon;
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }

    private String normalizeAddonId(String addonKey) {
        String value = addonKey.trim();

        if (value.startsWith("Addon|")) {
            return value;
        }

        return "Addon|" + value;
    }

    private String defaultStatus(String status) {
        if (status == null || status.isBlank()) {
            return DEFAULT_STATUS;
        }

        return status.trim().toUpperCase();
    }
}
