package com.rc.aroyacruise.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record NodeReservationAddonUpdateRequest(

        @NotBlank
        String reservationId,

        @NotEmpty
        List<@Valid NodeReservationAddonRequest> addons
) {
}
