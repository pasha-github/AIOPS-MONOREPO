package com.rc.aroyacruise.controller;

import com.rc.aroyacruise.service.NodeAroyaHomePageVoyageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/v2/api/sc/voyages-recommendation")
@RequiredArgsConstructor
public class AroyaHomePageVoyageController {

    private final NodeAroyaHomePageVoyageService homePageVoyageService;

    @GetMapping
    public JsonNode getHomePageVoyages(
    ) {
        return homePageVoyageService.getHomePageVoyages();
    }
}
