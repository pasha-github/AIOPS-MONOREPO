package com.rc.customerapp.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DocFlowController {

    /**
     * GET /doc-flow
     * Serves the bundled DocFlow page from static resources.
     */
    @GetMapping("/doc-flow")
    public String docFlow() {
        return "forward:/doc-flow.html";
    }
}
