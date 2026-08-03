package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.dto.request.NodeAvailableShorexRequest;
import com.rc.aroyacruise.dto.request.NodeReservationShorexUpdateRequest;
import com.rc.aroyacruise.service.NodeAroyaReservationShorexService;
import com.rc.aroyacruise.service.NodeAroyaShorexJsonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/shorex")
@RequiredArgsConstructor
public class AroyaShorexController {

    private final NodeAroyaShorexJsonService shorexJsonService;
    private final NodeAroyaReservationShorexService reservationShorexService;

    @PostMapping("/available")
    public JsonNode getAvailableShorex(
            @Valid @RequestBody NodeAvailableShorexRequest request
    ) {
        return shorexJsonService.getAvailableShorexJson(
                request
        );
    }

    @PostMapping("/update")
    public JsonNode updateReservationShorex(
            @Valid @RequestBody NodeReservationShorexUpdateRequest request,
            @RequestHeader(
                    value = HttpHeaders.AUTHORIZATION,
                    required = false
            )
            String bearerToken
    ) {
        return reservationShorexService.updateReservationShorex(
                request,
                bearerToken
        );
    }


}
