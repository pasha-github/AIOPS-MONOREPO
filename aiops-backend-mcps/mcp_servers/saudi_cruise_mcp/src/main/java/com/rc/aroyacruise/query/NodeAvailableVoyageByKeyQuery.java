package com.rc.aroyacruise.query;

import java.util.Map;

public class NodeAvailableVoyageByKeyQuery implements AroyaQuery {

    private static final String SITE = "website";
    private static final String LOCALE = "en";

    private final String packageKey;

    public NodeAvailableVoyageByKeyQuery(String packageKey) {
        this.packageKey = packageKey;
    }

    @Override
    public String query() {
        return """
            query Query($params: AvailableVoyageParams!) {
              availableVoyage(params: $params) {
                pkg {
                  key
                  type {
                    cms {
                      title
                      duration
                    }
                  }
                }
                availableCategories {
                  cabinCategory {
                    cabinCapacity
                    categoryCapacity
                    code
                    comments
                    description
                    id
                    key
                    keys
                    rank
                  }
                }
                sailActivities {
                  comments
                  cargoStatus
                  dateTime
                  description
                  dressCode
                  id
                  itineraryDescription
                  itineraryTitle
                  key
                  keys
                  mayDisembark
                  mayEmbark
                  notes
                  ownership
                  port {
                    name
                    key
                  }
                  sailActivityId
                  recordId
                  sailRefId
                  sailRefIdent
                  type {
                    comments
                    key
                  }
                }
                inventoryResult
              }
            }
            """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of(
                "params",
                Map.of(
                        "locale", LOCALE,
                        "pkgKey", packageKey,
                        "site", SITE
                )
        );
    }
}