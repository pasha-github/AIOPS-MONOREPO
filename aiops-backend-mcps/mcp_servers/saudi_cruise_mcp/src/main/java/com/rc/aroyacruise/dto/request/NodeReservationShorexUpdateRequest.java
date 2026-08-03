package com.rc.aroyacruise.dto.request;


import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record NodeReservationShorexUpdateRequest(

        @NotBlank
        String reservationId,

        Boolean replaceAll,

        @NotEmpty
        List<@Valid NodeReservationShorexRequest> shorex
) {
}
