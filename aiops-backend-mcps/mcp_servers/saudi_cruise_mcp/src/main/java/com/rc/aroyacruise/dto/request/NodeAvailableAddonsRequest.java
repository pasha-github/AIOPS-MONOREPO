package com.rc.aroyacruise.dto.request;

import jakarta.validation.constraints.NotBlank;

public record NodeAvailableAddonsRequest(

        @NotBlank
        String reservationId,

        Boolean withMandatory,

        Boolean withClassification
) {
}
