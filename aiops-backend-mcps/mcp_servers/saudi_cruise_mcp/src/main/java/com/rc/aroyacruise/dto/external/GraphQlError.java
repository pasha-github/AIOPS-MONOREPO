package com.rc.aroyacruise.dto.external;

import java.util.List;
import java.util.Map;

public record GraphQlError(
        String message,
        List<Map<String, Object>> locations,
        List<Object> path,
        Map<String, Object> extensions
) {
}
