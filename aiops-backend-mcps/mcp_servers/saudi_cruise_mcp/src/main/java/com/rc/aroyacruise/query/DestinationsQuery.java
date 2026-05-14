package com.rc.aroyacruise.query;

import java.util.Map;

public class DestinationsQuery implements AroyaQuery {

    @Override
    public String query() {
        return """
                query Destinations {
                  destinations {
                    name
                    comments
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of();
    }
}
