package com.rc.aroyacruise.query;

import java.util.Map;

public class PortsQuery implements AroyaQuery {

    @Override
    public String query() {
        return """
                query Ports {
                  ports {
                    id
                    code
                    name
                  }
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of();
    }
}
