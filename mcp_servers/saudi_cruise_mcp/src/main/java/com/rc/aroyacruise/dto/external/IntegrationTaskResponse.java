package com.rc.aroyacruise.dto.external;

import java.util.List;

public record IntegrationTaskResponse<T>(
        T data,
        List<GraphQlError> errors,
        ExtensionsDto extensions
) {
}