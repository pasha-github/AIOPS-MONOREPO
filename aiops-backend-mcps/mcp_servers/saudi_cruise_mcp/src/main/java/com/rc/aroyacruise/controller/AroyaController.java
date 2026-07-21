package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.dto.request.AroyaLoginRequest;
import com.rc.aroyacruise.dto.request.AvailableVoyagesRequest;
import com.rc.aroyacruise.dto.response.ApiResponse;
import com.rc.aroyacruise.dto.response.AroyaLoginResponse;
import com.rc.aroyacruise.service.AroyaService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v1/api/sc")
public class AroyaController {

    private final AroyaService aroyaService;

    public AroyaController(AroyaService aroyaService) {
        this.aroyaService = aroyaService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AroyaLoginResponse>> login(@Valid @RequestBody AroyaLoginRequest request) {
        AroyaLoginResponse response = aroyaService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    @GetMapping("/ports")
    public ResponseEntity<ApiResponse<JsonNode>> getPorts() {
        JsonNode response = aroyaService.getPorts();
        return ResponseEntity.ok(ApiResponse.success("Ports fetched successfully", response));
    }

    @PostMapping("/voyages/available")
    public ResponseEntity<ApiResponse<JsonNode>> getAvailableVoyages(
            @Valid @RequestBody AvailableVoyagesRequest request
    ) {
        JsonNode response = aroyaService.getAvailableVoyages(request,null);
        return ResponseEntity.ok(ApiResponse.success("Available voyages fetched successfully", response));
    }

    @GetMapping("/destinations")
    public ResponseEntity<ApiResponse<JsonNode>> getDestinations() {
        JsonNode response = aroyaService.getDestinations();
        return ResponseEntity.ok(ApiResponse.success("Destinations fetched successfully", response));
    }


}