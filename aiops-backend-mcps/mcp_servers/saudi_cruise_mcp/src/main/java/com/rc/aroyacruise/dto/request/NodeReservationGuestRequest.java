package com.rc.aroyacruise.dto.request;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NodeReservationGuestRequest(

        @NotNull
        @Positive
        @JsonPropertyDescription("""
                Guest sequence number. This number is used to assign guests to cabins.
                Example: 1
                """)
        Integer seqN,

        @NotBlank
        @JsonPropertyDescription("""
                Client ID.
                Example: "39616"
                """)
        String clientId
) {
}