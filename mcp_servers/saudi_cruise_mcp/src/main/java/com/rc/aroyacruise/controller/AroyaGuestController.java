package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.dto.request.NodeAddGuestsRequest;
import com.rc.aroyacruise.service.NodeAroyaGuestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/guests")
@RequiredArgsConstructor
public class AroyaGuestController {

    private final NodeAroyaGuestService guestService;

    @PostMapping("/add")
    public JsonNode addGuests(
            @Valid @RequestBody NodeAddGuestsRequest request
    ) {
        return guestService.addGuests(request);
    }
}