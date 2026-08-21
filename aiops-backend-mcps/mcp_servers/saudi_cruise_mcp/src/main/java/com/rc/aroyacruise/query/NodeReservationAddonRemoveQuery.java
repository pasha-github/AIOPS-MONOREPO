package com.rc.aroyacruise.query;

import com.rc.aroyacruise.dto.request.NodeReservationAddonRemoveRequest;

import java.util.Map;
import java.util.stream.Collectors;

public class NodeReservationAddonRemoveQuery implements AroyaQuery {

    private final NodeReservationAddonRemoveRequest request;

    public NodeReservationAddonRemoveQuery(
            NodeReservationAddonRemoveRequest request
    ) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ReservationAddonRemove {
                  reservationAddonRemove(
                    input: {
                      id: %s
                      recordIds: [%s]
                    }
                  ) {
                    operationResult
                    clientMutationId
                    result {
                      key
                      id
                      guid
                      alphaNumId
                      initialDate
                      currencyRate
                      guestCount
                      version
                      lastUpdated
                      status {
                        name
                      }
                      invoiceTotals {
                        invoiceTotal
                        payments
                        refunds
                        invoicePaid
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
                      lastInvoice {
                        refNumber
                        invoiceId
                        amount
                        date
                        paid
                        status
                      }
                      shorex {
                        price
                        effectiveDate
                        code
                        status
                        pkg {
                          key
                          description
                          type {
                            key
                          }
                        }
                        guest {
                          seqN
                          client {
                            key
                            fullName
                          }
                        }
                      }
                      addons {
                        price
                        effectiveDate
                        quantity
                        recordId
                        mandatory
                        isSpecialRequest
                        addon {
                          key
                          category {
                            key
                          }
                          type {
                            key
                          }
                          name
                          classifications {
                            code
                          }
                        }
                        guest {
                          seqN
                          client {
                            key
                            fullName
                          }
                        }
                      }
                      voyages {
                        pkg {
                          key
                          destination
                          sailDays
                          landDays
                          name
                          description
                          typeName
                          typeComment
                          destinations {
                            name
                            comments
                          }
                          type {
                            key
                          }
                        }
                        cabinChain {
                          cabin {
                            key
                            id
                            number
                            deck {
                              key
                              number
                            }
                            category {
                              key
                              code
                              description
                              ship {
                                key
                                id
                              }
                            }
                          }
                          sail {
                            from {
                              dateTime
                              sailRefID
                              port {
                                name
                              }
                            }
                            to {
                              dateTime
                              sailRefID
                              port {
                                name
                              }
                            }
                          }
                        }
                        dateTimeRange {
                          from
                          to
                        }
                      }
                      guests {
                        seqN
                        age
                        client {
                          key
                          mobileIntlCode
                          mobilePhoneNumber
                          firstName
                          lastName
                          household {
                            addresses {
                              city
                            }
                          }
                          middleName
                          fullName
                          eMail
                          birthday
                          countryOfBirth {
                            name
                          }
                          gender
                          citizenship {
                            name
                          }
                          title {
                            key
                          }
                        }
                      }
                      originalInitialDate
                      charges {
                        actionCode
                        dateTime
                        manual
                        designatedPaymentCode
                        paid
                        paidDate
                        charges {
                          amount
                          state
                          chargeCode
                          comments
                          updatedBy
                          updatedAt
                          calculatedAmount
                        }
                      }
                      confirmationDate
                      cancellationCase {
                        key
                        name
                      }
                      calculatedFields {
                        penaltyInfo {
                          amount
                          charges {
                            chargeCode
                            amount
                            businessArea
                            explanation
                          }
                          date
                        }
                      }
                      invoice {
                        guest {
                          seqN
                          client {
                            key
                            fullName
                          }
                        }
                        type {
                          key
                        }
                        amount
                        priceArea
                        promotion {
                          key
                          type
                          name
                        }
                      }
                    }
                  }
                }
                """.formatted(
                graphQlString(normalizeReservationId(request.reservationId())),
                recordIds()
        );
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of();
    }

    private String normalizeReservationId(String reservationId) {
        String value = reservationId.trim();

        if (value.startsWith("Reservation|")) {
            return value;
        }

        return "Reservation|" + value;
    }

    private String recordIds() {
        return request.recordIds()
                .stream()
                .map(String::valueOf)
                .collect(Collectors.joining(", "));
    }

    private String graphQlString(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                + "\"";
    }
}