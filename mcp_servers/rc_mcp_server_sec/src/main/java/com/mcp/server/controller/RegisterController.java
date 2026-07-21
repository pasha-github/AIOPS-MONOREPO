package com.mcp.server.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.*;

import com.mcp.server.entity.Tool;
import com.mcp.server.entity.ToolParameter;
import com.mcp.server.repository.ToolRepository;

@RestController
@RequestMapping("/{tenantId}/{connectorId}/mcp")
public class RegisterController {

    private final ToolRepository repo;

    public RegisterController(ToolRepository repo) {
        this.repo = repo;
    }

    @PostMapping("/register")
    public Map<String, Object> registerTool(
            @PathVariable String tenantId,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> request) {

        Object id = request.get("id") != null ? request.get("id") : "1";

        try {

            String toolName = (String) request.get("toolName");

            if (toolName == null || toolName.isEmpty()) {
                return errorResponse(id, -32602, "toolName required");
            }

            Tool tool = new Tool();
            tool.setToolName(toolName);

            tool.setConnectorId(connectorId);
            tool.setOrgKey(tenantId);

            tool.setMethod((String) request.getOrDefault("method", "POST"));
           // tool.setEndpoint((String) request.get("endpoint"));

            List<Map<String, Object>> paramsList =
                    (List<Map<String, Object>>) request.getOrDefault("parameters", new ArrayList<>());

            List<ToolParameter> parameters = new ArrayList<>();

            for (Map<String, Object> p : paramsList) {

                if (p.get("name") == null) continue;

                ToolParameter param = new ToolParameter();

                param.setName((String) p.get("name"));
                param.setType((String) p.getOrDefault("type", "string"));
                param.setRequired((Boolean) p.getOrDefault("required", false));

                param.setParamIn((String) p.getOrDefault("in", "body"));
                param.setDescription((String) p.getOrDefault("description", ""));
                param.setExample(String.valueOf(p.getOrDefault("example", "")));

                parameters.add(param);
            }

            tool.setParameters(parameters);

            repo.save(tool);

            Map<String, Object> result = new HashMap<>();
            result.put("status", "Tool registered successfully");
            result.put("toolName", toolName);

            Map<String, Object> response = new HashMap<>();
            response.put("jsonrpc", "2.0");
            response.put("id", id);
            response.put("result", result);

            return response;

        } catch (Exception e) {
            return errorResponse(id, -32000, e.getMessage());
        }
    }

    private Map<String, Object> errorResponse(Object id, int code, String message) {

        Map<String, Object> error = new HashMap<>();
        error.put("code", code);
        error.put("message", message);

        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("error", error);

        return response;
    }
}