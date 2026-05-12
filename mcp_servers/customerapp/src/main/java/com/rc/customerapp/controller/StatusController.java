package com.rc.customerapp.controller;

import com.rc.customerapp.service.StatusService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class StatusController {

    private final StatusService statusService;

    public StatusController(StatusService statusService) {
        this.statusService = statusService;
    }

    /**
     * POST /api/start
     * Sets the global status to START.
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> start() {
        statusService.setStart();
        return ResponseEntity.ok(Map.of(
                "message", "Status updated to START",
                "status", statusService.getStatus().name(),
                "timestamp", Instant.now().toString()
        ));
    }

    /**
     * POST /api/stop
     * Sets the global status to STOP.
     */
    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stop() {
        statusService.setStop();
        return ResponseEntity.ok(Map.of(
                "message", "Status updated to STOP",
                "status", statusService.getStatus().name(),
                "timestamp", Instant.now().toString()
        ));
    }

    /**
     * GET /api/status
     * Returns the current value of the global status variable.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of(
                "status", statusService.getStatus().name(),
                "timestamp", Instant.now().toString()
        ));
    }
}
