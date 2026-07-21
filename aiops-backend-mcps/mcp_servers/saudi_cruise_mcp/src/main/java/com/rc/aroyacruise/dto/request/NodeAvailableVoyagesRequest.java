package com.rc.aroyacruise.dto.request;


import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record NodeAvailableVoyagesRequest(
        Integer offset,
        Integer limit,

        @NotBlank
        String startDateFrom,

        @NotBlank
        String startDateTo,

        List<String> destinations,
        List<String> departurePorts
) {
}
