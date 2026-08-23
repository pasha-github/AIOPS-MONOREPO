package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeAvailableAddonsRequest;
import com.rc.aroyacruise.dto.request.NodeReservationAddonRemoveRequest;
import com.rc.aroyacruise.dto.request.NodeReservationAddonUpdateRequest;
import com.rc.aroyacruise.service.NodeAroyaAddonJsonService;
import com.rc.aroyacruise.service.NodeAroyaReservationAddonRemoveJsonService;
import com.rc.aroyacruise.service.NodeAroyaReservationAddonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/addons")
@RequiredArgsConstructor
public class AroyaAddonController {

    private final NodeAroyaAddonJsonService addonJsonService;
    private final NodeAroyaReservationAddonService reservationAddonService;
    private final NodeAroyaReservationAddonRemoveJsonService addonRemoveJsonService;

    @PostMapping("/available")
    public JsonNode getAvailableAddons(
            @Valid @RequestBody NodeAvailableAddonsRequest request
    ) {
        return addonJsonService.getAvailableAddonsJson(
                request
        );
    }

    @PostMapping("/update")
    public JsonNode updateReservationAddons(
            @Valid @RequestBody NodeReservationAddonUpdateRequest request
    ) {
        return reservationAddonService.updateReservationAddons(
                request

        );
    }

    @PostMapping("/remove")
    public JsonNode removeReservationAddons(
            @Valid @RequestBody NodeReservationAddonRemoveRequest request
    ) {
        return addonRemoveJsonService.removeReservationAddonsJson(
                request,
                null
        );
    }
}
