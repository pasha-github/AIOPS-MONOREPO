package com.rc.aroyacruise.dto.request;

import jakarta.validation.constraints.NotBlank;

public record NodeAvailableShorexRequest(

        @NotBlank
        String reservationId,

        Boolean matchItinerary,

        String locale,

        String site
) {
}