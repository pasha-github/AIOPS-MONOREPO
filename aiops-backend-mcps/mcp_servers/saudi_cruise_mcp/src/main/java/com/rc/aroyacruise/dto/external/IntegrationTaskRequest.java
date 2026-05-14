package com.rc.aroyacruise.dto.external;


import java.util.Map;

public record IntegrationTaskRequest(
        String query,
        Map<String, Object> variables
) {
}
