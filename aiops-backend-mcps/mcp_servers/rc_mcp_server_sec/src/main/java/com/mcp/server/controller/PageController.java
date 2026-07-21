package com.mcp.server.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import com.mcp.server.entity.Tool;
import com.mcp.server.repository.ToolRepository;

@Controller
public class PageController {

    @Autowired
    private ToolRepository toolRepository;

    @GetMapping("/view")
    public String viewPage(Model model) {
        try {
            List<Tool> allTools = toolRepository.findAll();

            Map<String, List<Tool>> groupedByConnector = allTools.stream()
                .collect(Collectors.groupingBy(Tool::getConnectorId));

            List<Map<String, Object>> mcpList = new ArrayList<>();
            for (Map.Entry<String, List<Tool>> entry : groupedByConnector.entrySet()) {
                String connectorId = entry.getKey();
                List<Tool> tools = entry.getValue();
                Tool first = tools.get(0);

                Map<String, Object> row = new HashMap<>();
                row.put("connectorId", connectorId);
                row.put("connectorName", first.getConnectorName());
                row.put("tenantId", first.getTenantId());
                row.put("baseUrl", first.getBaseUrl());
                row.put("specUrl", first.getSpecUrl());
                row.put("description", first.getDescription());
                row.put("toolsCount", tools.size());
                row.put("url", "https://rc-mcp-server-sec-428716175586.us-central1.run.app/" + first.getTenantId() + "/" + connectorId + "/mcp");

                mcpList.add(row);
            }

            model.addAttribute("mcpList", mcpList);
            return "View";

        } catch (Exception e) {
            e.printStackTrace();
            return "error";
        }
    }
}
