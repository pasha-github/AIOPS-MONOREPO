package com.rc.aroyacruise.dto.request;


import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record NodeAddGuestsRequest(

        @NotEmpty
        List<@Valid NodeGuestRequest> guests
) {
}