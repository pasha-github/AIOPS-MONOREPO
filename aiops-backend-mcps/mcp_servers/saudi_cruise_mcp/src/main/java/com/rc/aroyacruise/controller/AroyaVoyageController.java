package com.rc.aroyacruise.controller;



import com.rc.aroyacruise.dto.request.NodeAvailableVoyagesRequest;
import com.rc.aroyacruise.service.NodeAroyaVoyageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/voyages")
@RequiredArgsConstructor
public class AroyaVoyageController {

    private final NodeAroyaVoyageService voyageService;

    @PostMapping("/available")
    public JsonNode getAvailableVoyages(@Valid @RequestBody NodeAvailableVoyagesRequest request) {
        return voyageService.getAvailableVoyages(request);
    }
}
