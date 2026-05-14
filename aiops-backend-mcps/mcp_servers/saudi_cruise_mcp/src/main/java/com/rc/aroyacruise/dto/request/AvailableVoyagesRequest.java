package com.rc.aroyacruise.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record AvailableVoyagesRequest(
        @NotBlank String startDateFrom,
        @NotBlank String startDateTo,
        @NotEmpty List<String> destinations,
        @NotEmpty List<String> departurePorts
) {
}