package com.rc.aroyacruise.dto.request;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record NodeReservationVoyageRequest(

        @NotNull
        @Positive
        @JsonPropertyDescription("""
                Cabin sequence number.
                Example: 1
                """)
        Integer cabinSeqN,

        @NotBlank
        @JsonPropertyDescription("""
                Selected voyage package.
                Example: "AC01260912REPJED-8"
                """)
        String packageKey,

        @NotBlank
        @JsonPropertyDescription("""
                Selected cabin category key.
                Example: "AC01,IC"
                """)
        String categoryKey,

        @Pattern(
                regexp = "OK|AVAILABLE|UNAVAILABLE|ON_REQUEST|WAITLIST|CLOSED|OPEN",
                message = "Availability must be one of: OK, AVAILABLE, UNAVAILABLE, ON_REQUEST, WAITLIST, CLOSED, OPEN"
        )
        @JsonPropertyDescription("""
                Cabin availability status.
                Allowed values: "OK", "AVAILABLE", "UNAVAILABLE", "ON_REQUEST", "WAITLIST", "CLOSED", "OPEN".
                Usually use "OK" when the selected cabin is bookable.
                Example: "OK"
                """)
        String availability,

        @NotEmpty
        @JsonPropertyDescription("""
                Guest sequence numbers assigned to this cabin.
                These numbers must match guests seqN from the reservation guests list.
                Examples: [1], [1, 2]
                """)
        List<@Positive Integer> guests
) {
}