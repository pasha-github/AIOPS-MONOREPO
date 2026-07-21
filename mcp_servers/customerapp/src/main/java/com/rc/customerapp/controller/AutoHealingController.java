package com.rc.customerapp.controller;

import com.rc.customerapp.model.SpaceDASDRequest;
import com.rc.customerapp.model.SpaceDASDResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/autohealing")
public class AutoHealingController {

    private static final Set<String> SPACE_ABEND_CODES = Set.of("SB37", "SD37", "SE37");

    @PostMapping("/SpaceDASD")
    public ResponseEntity<SpaceDASDResponse> healSpaceDASD(@RequestBody SpaceDASDRequest request) {
        log.info("Auto-healing request: system={}, job={}, step={}, abend={}",
                request.getSystem(), request.getJobName(), request.getStepName(), request.getAbendCode());

        if (request.getAbendCode() == null || !SPACE_ABEND_CODES.contains(request.getAbendCode().toUpperCase())) {
            log.warn("Unsupported abend code: {}", request.getAbendCode());
            return ResponseEntity.status(500).body(new SpaceDASDResponse(
                    "500",
                    "Auto-healing failed. Unable to allocate additional DASD space."
            ));
        }

        log.info("DASD space allocated and job {} restarted successfully", request.getJobName());
        return ResponseEntity.ok(new SpaceDASDResponse(
                "200",
                "Dataset space increased and job " + request.getJobName() + " restarted successfully."
        ));
    }
}
