package com.rc.aroyacruise.query;

import java.util.Map;

public interface AroyaQuery {

    String query();

    default Map<String, Object> variables() {
        return Map.of();
    }
}
