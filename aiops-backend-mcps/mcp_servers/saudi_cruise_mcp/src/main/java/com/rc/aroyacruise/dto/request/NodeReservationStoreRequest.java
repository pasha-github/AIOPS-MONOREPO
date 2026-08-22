package com.rc.aroyacruise.dto.request;


import jakarta.validation.constraints.NotBlank;

public record NodeReservationStoreRequest(

        @NotBlank
        String reservationId,

        Boolean unlock
) {
}
