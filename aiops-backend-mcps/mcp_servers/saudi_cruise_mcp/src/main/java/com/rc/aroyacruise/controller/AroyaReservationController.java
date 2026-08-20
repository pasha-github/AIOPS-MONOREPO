package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.dto.request.NodeCreateReservationRequest;
import com.rc.aroyacruise.dto.request.NodeReservationStoreRequest;
import com.rc.aroyacruise.service.NodeAroyaReservationService;
import com.rc.aroyacruise.service.NodeAroyaReservationStoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/reservations")
@RequiredArgsConstructor
public class AroyaReservationController {

    private final NodeAroyaReservationService reservationService;
    private final NodeAroyaReservationStoreService reservationStoreService;

    @PostMapping("/create")
    public JsonNode createReservation(
            @Valid
            @RequestBody
            NodeCreateReservationRequest request,

            @RequestHeader(
                    value = HttpHeaders.AUTHORIZATION,
                    required = false
            )
            String bearerToken
    ) {
        return reservationService.createReservation(
                request,
                bearerToken
        );
    }

    @PostMapping("/store")
    public JsonNode storeReservation(
            @Valid @RequestBody NodeReservationStoreRequest request
    ) {
        return reservationStoreService.storeReservation(
                request
        );
    }
}
