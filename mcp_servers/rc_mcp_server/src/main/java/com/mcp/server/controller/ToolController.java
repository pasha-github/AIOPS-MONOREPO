package com.mcp.server.controller;

import com.mcp.server.entity.Tool;
import com.mcp.server.entity.ToolParameter;
import com.mcp.server.repository.ToolRepository;
import com.mcp.server.service.ToolExecutor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;

@RestController
@RequestMapping("/mcp")
public class ToolController {

    private final ToolRepository repo;
    private final ToolExecutor executor;

    public ToolController(ToolRepository repo, ToolExecutor executor) {
        this.repo = repo;
        this.executor = executor;
    }

    // ---------------------------
    // HEALTH CHECK
    // ---------------------------
    @GetMapping
    public Map<String, Object> healthCheck() {
        return Map.of(
                "status", "MCP server running v.10",
                "server", "enterprise-mcp-server Google Cloud"
        );
    }

    // ---------------------------
    // MCP ENTRY
    // ---------------------------
    @PostMapping
    public Map<String, Object> handleMcp(
            @RequestHeader(value = "orgKey", required = false) String headerOrgKey,
            @RequestHeader(value = "connectorId", required = false) String headerConnectorId,
            @RequestBody Map<String, Object> request) {

        // Use default ID "1" if null
        Object id = request.get("id") != null ? request.get("id") : "1";

        String method = (String) request.get("method");

        if ("initialize".equals(method)) {
            return initialize(id);
        }

        if ("ping".equals(method)) {
            return ping(id);
        }
        if ("notifications/initialized".equals(method)) {
            return Map.of(
            		"id",2,
                "jsonrpc","2.0",
                "result", Map.of()
            );
            
        }

        if ("tools/list".equals(method)) {
            Map<String, Object> params = (Map<String, Object>) request.get("params");
            if (params == null) params = new HashMap<>();
            // Override with headers if present
            if (headerOrgKey != null) params.put("orgKey", headerOrgKey);
            if (headerConnectorId != null) params.put("connectorId", headerConnectorId);
            
            System.out.println("Calling Inside Tool List"+method+params);
            
            return buildToolsList(id, params);
        }
        
        if ("tools/call".equals(method)) {
        	Map<String, Object> params = (Map<String, Object>) request.get("params");
            if (params == null) params = new HashMap<>();
            // Override with headers if present
            if (headerOrgKey != null) params.put("orgKey", headerOrgKey);
            if (headerConnectorId != null) params.put("connectorId", headerConnectorId);
            return executeToolCall(id, request);
        }

        return errorResponse(id, -32601, "Method not found");
    }


    
    // ---------------------------
    // INITIALIZE
    // ---------------------------
    private Map<String, Object> initialize(Object id) {
        Map<String, Object> capabilities = new HashMap<>();
        capabilities.put("tools", new HashMap<>());

        Map<String, Object> serverInfo = new HashMap<>();
        serverInfo.put("name", "enterprise-mcp-server");
        serverInfo.put("version", "1.0.0");

        Map<String, Object> result = new HashMap<>();
        result.put("protocolVersion", "2024-11-05");
        result.put("capabilities", capabilities);
        result.put("serverInfo", serverInfo);

        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);

        return response;
    }
   

    // ---------------------------
    // PING
    // ---------------------------
    private Map<String, Object> ping(Object id) {
        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", new HashMap<>());
        return response;
    }

  
    private Map<String, Object> buildToolsList(Object id, Map<String, Object> params) {

        // Get orgKey and connectorId from headers/params
        String orgKey = params != null ? (String) params.get("orgKey") : null;
        String connectorId = params != null ? (String) params.get("connectorId") : null;

        // Fetch tools with parameters eagerly to avoid multiple Hibernate queries
        List<Tool> tools = repo.findByOrgKeyAndConnectorId(orgKey, connectorId);
        List<Map<String, Object>> mcpTools = new ArrayList<>();

        for (Tool tool : tools) {
            Map<String, Object> properties = new HashMap<>();
            List<String> required = new ArrayList<>();

            // Check for null parameters to avoid NullPointerException
            if (tool.getParameters() != null) {
                for (ToolParameter p : tool.getParameters()) {
                    Map<String, Object> prop = new HashMap<>();
                    prop.put("type", p.getType() != null ? p.getType() : "string"); // default to string
                    properties.put(p.getName(), prop);
                    if (p.isRequired()) required.add(p.getName());
                }
            }

            Map<String, Object> inputSchema = new HashMap<>();
            inputSchema.put("type", "object");
            inputSchema.put("properties", properties);
            if (!required.isEmpty()) inputSchema.put("required", required);

            Map<String, Object> toolMap = new HashMap<>();
            toolMap.put("name", tool.getToolName());
            toolMap.put("description", "Execute " + tool.getToolName());
            toolMap.put("inputSchema", inputSchema);

            mcpTools.add(toolMap);
        }

        // Always return a tools array
        Map<String, Object> result = new HashMap<>();
        
        result.put("tools", mcpTools);

        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id != null ? id : 1); // default id if null
        response.put("result", result);

        return response;
    }
    private Map<String, Object> executeToolCall(Object id, Map<String, Object> request) {

        // Extract parameters from MCP request
        Map<String, Object> params = (Map<String, Object>) request.get("params");
        if (params == null) params = new HashMap<>();

        String toolName = (String) params.get("name");
        Map<String, Object> arguments = (Map<String, Object>) params.getOrDefault("arguments", new HashMap<>());

        String orgKey = (String) params.get("orgKey");
        String connectorId = (String) params.get("connectorId");

        // Fetch the tool from repo
        List<Tool> tools = repo.findByToolNameAndOrgKeyAndConnectorId(toolName, orgKey, connectorId);
        if (tools == null || tools.isEmpty()) {
            return errorResponse(id, -32001, "Tool not found: " + toolName);
        }

        Tool tool = tools.get(0);

        // Execute the tool using your executor
        Object output;
        try {
            output = executor.executeTool(tool, arguments);
        } catch (Exception e) {
            return errorResponse(id, -32002, "Tool execution failed: " + e.getMessage());
        }

        // Build the MCP-compliant response
        Map<String, Object> content = new HashMap<>();
        content.put("type", "text");
        content.put("text", String.valueOf(output));

        Map<String, Object> result = new HashMap<>();
        result.put("content", List.of(content));

        Map<String, Object> response = new HashMap<>();
        response.put("jsonrpc", "2.0");
        response.put("id", id);
        response.put("result", result);

        return response;
    }

    // ---------------------------
    // STREAM TOOL EXECUTION
    // ---------------------------
    @PostMapping(value = "/stream", produces = "text/event-stream")
    public SseEmitter streamTool(
            @RequestHeader(value = "orgKey", required = false) String headerOrgKey,
            @RequestHeader(value = "connectorId", required = false) String headerConnectorId,
            @RequestBody Map<String, Object> request) {

        SseEmitter emitter = new SseEmitter(0L);

        new Thread(() -> {
            try {
                Object id = request.get("id") != null ? request.get("id") : "1";

                Map<String, Object> params = (Map<String, Object>) request.get("params");
                if (params == null) params = new HashMap<>();
                // Override with headers if present
                if (headerOrgKey != null) params.put("orgKey", headerOrgKey);
                if (headerConnectorId != null) params.put("connectorId", headerConnectorId);

                String toolName = (String) params.get("name");
                String orgKey = (String) params.get("orgKey");
                String connectorId = (String) params.get("connectorId");

                Map<String, Object> arguments =
                        (Map<String, Object>) params.getOrDefault("arguments", new HashMap<>());

                List<Tool> tools = repo.findByToolNameAndOrgKeyAndConnectorId(toolName, orgKey, connectorId);
                if (tools == null || tools.isEmpty()) {
                    emitter.send(errorResponse(id, -32001, "Tool not found"));
                    emitter.complete();
                    return;
                }

                Tool tool = tools.get(0);
                Object output = executor.executeTool(tool, arguments);

                Map<String, Object> content = new HashMap<>();
                content.put("type", "text");
                content.put("text", String.valueOf(output));

                Map<String, Object> result = new HashMap<>();
                result.put("content", List.of(content));

                Map<String, Object> response = new HashMap<>();
                response.put("jsonrpc", "2.0");
                response.put("id", id);
                response.put("result", result);

                emitter.send(response);
                emitter.complete();

            } catch (Exception e) {
                try {
                    emitter.send(Map.of("error", e.getMessage()));
                } catch (Exception ignore) {
                }
                emitter.completeWithError(e);
            }
        }).start();

        return emitter;
    }

    // ---------------------------
    // REGISTER TOOL
    // ---------------------------
    @PostMapping("/register")
    public Map<String, Object> registerTool(@RequestBody Map<String, Object> request) {
        Object id = request.get("id") != null ? request.get("id") : "1";

        try {
            String toolName = (String) request.get("toolName");
            if (toolName == null || toolName.isEmpty()) {
                return errorResponse(id, -32602, "toolName required");
            }

            Tool tool = new Tool();
            tool.setToolName(toolName);
            tool.setConnectorId((String) request.get("connectorId"));
            tool.setOrgKey((String) request.get("orgKey"));
            tool.setMethod((String) request.get("method"));
            tool.setEndpoint((String) request.get("endpoint"));

            List<Map<String, Object>> paramsList =
                    (List<Map<String, Object>>) request.getOrDefault("parameters", new ArrayList<>());

            List<ToolParameter> parameters = new ArrayList<>();
            for (Map<String, Object> p : paramsList) {
                ToolParameter param = new ToolParameter();
                param.setName((String) p.get("name"));
                param.setType((String) p.getOrDefault("type", "string"));
                param.setRequired((Boolean) p.getOrDefault("required", false));
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

    // ---------------------------
    // ERROR RESPONSE
    // ---------------------------
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
