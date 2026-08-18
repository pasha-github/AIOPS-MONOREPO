package com.rc.aroyacruise.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record NodeReservationAddonRequest(

        @NotBlank
        String addonKey,

        String status,

        @NotBlank
        String dateFrom,

        @NotBlank
        String dateTo,

        @Positive
        Integer quantity,

        @NotEmpty
        List<@Positive Integer> guests,

        @NotEmpty
        List<@NotBlank String> linkedComponent
) {
}
