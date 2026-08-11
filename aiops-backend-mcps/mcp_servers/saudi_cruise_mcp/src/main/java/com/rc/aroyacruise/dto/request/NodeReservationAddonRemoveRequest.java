package com.rc.aroyacruise.dto.request;


import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record NodeReservationAddonRemoveRequest(

        @NotBlank
        String reservationId,

        @NotEmpty
        List<@Positive Long> recordIds
) {
}
