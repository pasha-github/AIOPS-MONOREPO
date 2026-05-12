package com.mcp.server.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mcp.server.entity.Tool;
import com.mcp.server.entity.ToolParameter;
import com.mcp.server.repository.ToolRepository;
import com.mcp.server.service.ToolExecutor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.*;

@RestController
@RequestMapping("/{tenantId}/{connectorId}/mcp")
public class ToolController {

    private final ToolRepository repo;
    private final ToolExecutor executor;

    public ToolController(ToolRepository repo, ToolExecutor executor) {
        this.repo = repo;
        this.executor = executor;
    }

//    // ---------------------------
//    // HEALTH CHECK
//    // ---------------------------
//    @GetMapping
//    public Map<String, Object> healthCheck() {
//        return Map.of(
//                "status", "MCP server running v.10",
//                "server", "enterprise-mcp-server VM"
//        );
//    }

    // ---------------------------
    // MCP ENTRY
    // ---------------------------
    @PostMapping
    public Map<String, Object> handleMcp(
            @PathVariable String tenantId,
            @PathVariable String connectorId,
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
            if (tenantId!= null) params.put("orgKey", tenantId);
            if (connectorId != null) params.put("connectorId", connectorId);
            
            System.out.println("Calling Inside Tool List"+method+params);
            
            return buildToolsList(id, params);
        }
        
        if ("tools/call".equals(method)) {
        	Map<String, Object> params = (Map<String, Object>) request.get("params");
            if (params == null) params = new HashMap<>();
            // Override with headers if present
            if (tenantId!= null) params.put("orgKey", tenantId);
            if (connectorId != null) params.put("connectorId", connectorId);
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

        Map<String, Object> params = (Map<String, Object>) request.get("params");
        if (params == null) params = new HashMap<>();

        String toolName = (String) params.get("name");

        Map<String, Object> arguments =
                (Map<String, Object>) params.getOrDefault("arguments", new HashMap<>());

        String orgKey = (String) params.get("orgKey");
        String connectorId = (String) params.get("connectorId");

        List<Tool> tools = repo.findByToolNameAndOrgKeyAndConnectorId(toolName, orgKey, connectorId);

        if (tools == null || tools.isEmpty()) {
            return errorResponse(id, -32001, "Tool not found: " + toolName);
        }

        Tool tool = tools.get(0);

        System.out.println("🚀 TOOL CALL: " + toolName);
        System.out.println("📦 ARGUMENTS: " + arguments);

        // ============================
        // ✅ VALIDATION + CLEANING
        // ============================
        for (ToolParameter p : tool.getParameters()) {

            Object value = arguments.get(p.getName());

            if (p.isRequired() && (value == null || value.toString().isEmpty())) {
                return errorResponse(id, -32602,
                        "Missing required parameter: " + p.getName());
            }

            if (value == null) {
                arguments.remove(p.getName());
            }
        }

        // ============================
        // 🔥 SPLIT PARAMS
        // ============================
        Map<String, Object> queryParams = new HashMap<>();
        Map<String, Object> bodyParams = new HashMap<>();
        Map<String, Object> pathParams = new HashMap<>();

        for (ToolParameter p : tool.getParameters()) {

            Object value = arguments.get(p.getName());
            if (value == null) continue;

            String in = p.getParamIn() != null ? p.getParamIn() : "body";

            switch (in.toLowerCase()) {
                case "query":
                    queryParams.put(p.getName(), value);
                    break;
                case "path":
                    pathParams.put(p.getName(), value);
                    break;
                default:
                    bodyParams.put(p.getName(), value);
            }
        }

        // ============================
        // 🔥 BUILD FINAL URL (PATH + QUERY)
        // ============================
        String finalUrl = tool.getEndpoint();

        // Replace path variables
        for (String key : pathParams.keySet()) {
            finalUrl = finalUrl.replace("{" + key + "}", String.valueOf(pathParams.get(key)));
        }

        // Add query params
        if (!queryParams.isEmpty()) {
            StringBuilder queryString = new StringBuilder();

            queryParams.forEach((k, v) -> {
                if (queryString.length() > 0) queryString.append("&");
                queryString.append(k).append("=").append(v);
            });

            finalUrl = finalUrl + "?" + queryString;
        }

        System.out.println("🌐 FINAL URL: " + finalUrl);
        System.out.println("📨 BODY PARAMS: " + bodyParams);

        // ============================
        // 🔥 EXECUTE TOOL
        // ============================
        Object output;

        try {
            output = executor.executeTool(tool, finalUrl, bodyParams); // 🔥 UPDATED CALL
        } catch (Exception e) {
            return errorResponse(id, -32002, "Tool execution failed: " + e.getMessage());
        }

        // ============================
        // MCP RESPONSE
        // ============================
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
    
    

    @PostMapping(value = "/stream", produces = "text/event-stream")
    public SseEmitter streamTool(
    		@PathVariable String tenantId,
            @PathVariable String connectorId,
            @RequestBody Map<String, Object> request) {

        SseEmitter emitter = new SseEmitter(0L);

        new Thread(() -> {
            try {
                Object id = request.get("id") != null ? request.get("id") : "1";

                Map<String, Object> params = (Map<String, Object>) request.get("params");
                if (params == null) params = new HashMap<>();

                if (tenantId != null) params.put("orgKey", tenantId);
                if (connectorId != null) params.put("connectorId", connectorId);

                String toolName = (String) params.get("name");
                String orgKey = (String) params.get("orgKey");
                String connector_Id = (String) params.get("connectorId");

                Map<String, Object> arguments =
                        (Map<String, Object>) params.getOrDefault("arguments", new HashMap<>());

                System.out.println("🚀 STREAM TOOL CALL: " + toolName);
                System.out.println("📦 ARGUMENTS: " + arguments);

                //List<Tool> tools = repo.findByToolNameAndOrgKeyAndConnectorId(toolName, orgKey, connector_Id);
                
                List<Tool> tools =
                	    repo.findToolWithParameters(
                	        toolName,
                	        orgKey,
                	        connector_Id);

                if (tools == null || tools.isEmpty()) {
                    emitter.send(errorResponse(id, -32001, "Tool not found"));
                    emitter.complete();
                    return;
                }

                Tool tool = tools.get(0);

                // ============================
                // ✅ VALIDATION + CLEANING
                // ============================
                for (ToolParameter p : tool.getParameters()) {

                    Object value = arguments.get(p.getName());

                    if (p.isRequired() && (value == null || value.toString().isEmpty())) {
                        emitter.send(errorResponse(id, -32602,
                                "Missing required parameter: " + p.getName()));
                        emitter.complete();
                        return;
                    }

                    if (value == null) {
                        arguments.remove(p.getName());
                    }
                }

                // ============================
                // 🔥 SPLIT PARAMS
                // ============================
                Map<String, Object> queryParams = new HashMap<>();
                Map<String, Object> bodyParams = new HashMap<>();
                Map<String, Object> pathParams = new HashMap<>();

                for (ToolParameter p : tool.getParameters()) {

                    Object value = arguments.get(p.getName());
                    if (value == null) continue;

                    String in = p.getParamIn() != null ? p.getParamIn() : "body";

                    switch (in.toLowerCase()) {
                        case "query":
                            queryParams.put(p.getName(), value);
                            break;
                        case "path":
                            pathParams.put(p.getName(), value);
                            break;
                        default:
                            bodyParams.put(p.getName(), value);
                    }
                }

                // ============================
                // 🔥 BUILD URL
                // ============================
                String finalUrl = tool.getEndpoint();

                for (String key : pathParams.keySet()) {
                    finalUrl = finalUrl.replace("{" + key + "}", String.valueOf(pathParams.get(key)));
                }

                if (!queryParams.isEmpty()) {
                    StringBuilder queryString = new StringBuilder();

                    queryParams.forEach((k, v) -> {
                        if (queryString.length() > 0) queryString.append("&");
                        queryString.append(k).append("=").append(v);
                    });

                    finalUrl = finalUrl + "?" + queryString;
                }

                System.out.println("🌐 FINAL URL: " + finalUrl);
                System.out.println("📨 BODY PARAMS: " + bodyParams);

                // ============================
                // 🔥 EXECUTE TOOL
                // ============================
                Object output = executor.executeTool(tool, finalUrl, bodyParams);

                // ============================
                // STREAM RESPONSE
                // ============================
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
                } catch (Exception ignore) {}
                emitter.completeWithError(e);
            }
        }).start();

        return emitter;
    }
  
    
    
    // ---------------------------
    // SPEC UPLOAD REGISTER TOOL
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
            tool.setMethod((String) request.getOrDefault("method", "POST"));
            tool.setEndpoint((String) request.get("endpoint"));

            List<Map<String, Object>> paramsList =
                    (List<Map<String, Object>>) request.getOrDefault("parameters", new ArrayList<>());

            List<ToolParameter> parameters = new ArrayList<>();

            for (Map<String, Object> p : paramsList) {

                if (p.get("name") == null) continue;

                ToolParameter param = new ToolParameter();

                param.setName((String) p.get("name"));
                param.setType((String) p.getOrDefault("type", "string"));
                param.setRequired((Boolean) p.getOrDefault("required", false));

                // 🔥 NEW FIELDS (IMPORTANT)
                param.setParamIn((String) p.getOrDefault("in", "body")); // body/query/path
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
    
    
    @PostMapping("/apiSpecUpload")
    public String uploadSwaggerFromUrl(
            @RequestParam String orgKey,
            @RequestParam String connectorId,
            @RequestBody Map<String, String> request) {

        try {
            String url = request.get("url");
            String customBaseUrl = request.get("baseUrl");

            if (url == null || url.isEmpty()) {
                return "URL is required";
            }

            ObjectMapper mapper = new ObjectMapper();

            Map<String, Object> swagger =
                    mapper.readValue(new java.net.URL(url), Map.class);

            parseAndSaveTools(swagger, customBaseUrl, orgKey, connectorId);

            return "Swagger URL processed successfully";

        } catch (Exception e) {
            return "Tools Already Exist or Something went Wrong!";
        }
    }
    
    

  
    

    
    public void parseAndSaveTools(
            Map<String, Object> swagger,
            String customBaseUrl,
            String orgKey,
            String connectorId) {

        Map<String, Object> paths = (Map<String, Object>) swagger.get("paths");

        if (paths == null) {
            System.out.println("❌ No paths found");
            return;
        }

        // ==========================
        // ✅ Resolve Base URL
        // ==========================
        String baseUrl = "";

        if (swagger.containsKey("servers")) {
            List<Map<String, Object>> servers =
                    (List<Map<String, Object>>) swagger.get("servers");

            if (servers != null && !servers.isEmpty()) {
                baseUrl = (String) servers.get(0).get("url");
            }
        }

        if ((baseUrl == null || baseUrl.isEmpty()) && swagger.containsKey("host")) {

            String host = (String) swagger.get("host");
            String basePath = (String) swagger.getOrDefault("basePath", "");
            String scheme = "http";

            List<String> schemes = (List<String>) swagger.get("schemes");
            if (schemes != null && !schemes.isEmpty()) {
                scheme = schemes.get(0);
            }

            baseUrl = scheme + "://" + host + basePath;
        }

        if (customBaseUrl != null && !customBaseUrl.isEmpty()) {
            baseUrl = customBaseUrl;
        }

        if (baseUrl == null) baseUrl = "";

        // ==========================
        // 🔥 Iterate Paths
        // ==========================
        for (String path : paths.keySet()) {

            Map<String, Object> methods =
                    (Map<String, Object>) paths.get(path);

            for (String method : methods.keySet()) {

                Map<String, Object> apiDetails =
                        (Map<String, Object>) methods.get(method);

                Tool tool = new Tool();

                // ==========================
                // Tool Name
                // ==========================
                String toolName = path.substring(path.lastIndexOf("/") + 1);
                if (toolName.contains("{")) {
                    toolName = toolName.replaceAll("[{}]", "");
                }
                if (toolName.isEmpty()) {
                    toolName = "root";
                }

                tool.setToolName(toolName);
                tool.setMethod(method.toUpperCase());

                // ==========================
                // Endpoint
                // ==========================
                String finalBaseUrl = (customBaseUrl != null && !customBaseUrl.isEmpty())
                        ? customBaseUrl
                        : baseUrl;

                if (finalBaseUrl == null || finalBaseUrl.isEmpty()) {
                    finalBaseUrl = "http://127.0.0.1:8000";
                }

                String fullEndpoint;
                if (path.startsWith("http")) {
                    fullEndpoint = path;
                } else {
                    if (finalBaseUrl.endsWith("/") && path.startsWith("/")) {
                        fullEndpoint = finalBaseUrl.substring(0, finalBaseUrl.length() - 1) + path;
                    } else if (!finalBaseUrl.endsWith("/") && !path.startsWith("/")) {
                        fullEndpoint = finalBaseUrl + "/" + path;
                    } else {
                        fullEndpoint = finalBaseUrl + path;
                    }
                }

                tool.setEndpoint(fullEndpoint);
                tool.setOrgKey(orgKey);
                tool.setConnectorId(connectorId);

                List<ToolParameter> paramList = new ArrayList<>();

                // ==========================
                // ✅ QUERY + PATH PARAMS
                // ==========================
                List<Map<String, Object>> parameters =
                        (List<Map<String, Object>>) apiDetails.get("parameters");

                if (parameters != null) {
                    for (Map<String, Object> p : parameters) {

                        if (p.get("name") == null) continue;

                        ToolParameter param = new ToolParameter();
                        param.setName((String) p.get("name"));
                        param.setParamIn((String) p.getOrDefault("in", "query"));

                        Map<String, Object> schema =
                                (Map<String, Object>) p.get("schema");

                        if (schema != null) {
                            param.setType((String) schema.getOrDefault("type", "string"));
                        } else {
                            param.setType("string");
                        }

                        param.setRequired((Boolean) p.getOrDefault("required", false));
                        param.setDescription((String) p.getOrDefault("description", ""));
                        param.setExample("");

                        paramList.add(param);
                    }
                }

                // ==========================
                // 🔥 BODY PARAMS
                // ==========================
                Map<String, Object> requestBody =
                        (Map<String, Object>) apiDetails.get("requestBody");

                if (requestBody != null) {

                    Map<String, Object> content =
                            (Map<String, Object>) requestBody.get("content");

                    if (content != null) {

                        Map<String, Object> appJson =
                                (Map<String, Object>) content.get("application/json");

                        if (appJson != null) {

                            Map<String, Object> schema =
                                    (Map<String, Object>) appJson.get("schema");

                            // ==========================
                            // 🔥 HANDLE $ref
                            // ==========================
                            if (schema != null && schema.containsKey("$ref")) {

                                String ref = (String) schema.get("$ref");
                                String refName = ref.substring(ref.lastIndexOf("/") + 1);

                                Map<String, Object> components =
                                        (Map<String, Object>) swagger.get("components");

                                if (components != null) {
                                    Map<String, Object> schemas =
                                            (Map<String, Object>) components.get("schemas");

                                    if (schemas != null) {
                                        schema = (Map<String, Object>) schemas.get(refName);
                                    }
                                }
                            }

                            // ==========================
                            // 🔥 CASE 1: properties
                            // ==========================
                            if (schema != null && schema.get("properties") != null) {

                                Map<String, Object> properties =
                                        (Map<String, Object>) schema.get("properties");

                                List<String> requiredFields =
                                        (List<String>) schema.get("required");

                                for (String key : properties.keySet()) {

                                    Map<String, Object> prop =
                                            (Map<String, Object>) properties.get(key);

                                    ToolParameter param = new ToolParameter();
                                    param.setName(key);
                                    param.setType((String) prop.getOrDefault("type", "string"));
                                    param.setParamIn("body");

                                    boolean isRequired =
                                            requiredFields != null && requiredFields.contains(key);

                                   // param.setRequired(isRequired);
                                    param.setRequired(false);
                                    param.setDescription((String) prop.getOrDefault("description", ""));
                                    param.setExample("");

                                    paramList.add(param);
                                }
                            }

                            // ==========================
                            // 🔥 CASE 2: example fallback
                            // ==========================
                            else {

                                Map<String, Object> example =
                                        (Map<String, Object>) appJson.get("example");

                                if (example != null) {

                                    extractFromExample(example, paramList, "");
                                }
                            }
                        }
                    }
                }

                // ==========================
                // SAVE TOOL
                // ==========================
                tool.setParameters(paramList);

                List<Tool> existing = repo.findByToolNameAndOrgKeyAndConnectorId(
                        tool.getToolName(),
                        tool.getOrgKey(),
                        tool.getConnectorId()
                );

                if (existing != null && !existing.isEmpty()) {

                    Tool oldTool = existing.get(0);
                    oldTool.setEndpoint(tool.getEndpoint());
                    oldTool.setMethod(tool.getMethod());
                    oldTool.setParameters(paramList);

                    repo.save(oldTool);
                    System.out.println("🔁 Updated Tool: " + tool.getToolName());

                } else {

                    repo.save(tool);
                    System.out.println("✅ Inserted Tool: " + tool.getToolName());
                }

                System.out.println("📦 Params Count: " + paramList.size());
            }
        }
    }
    
    
    private void extractFromExample(
            Map<String, Object> example,
            List<ToolParameter> paramList,
            String parent) {

        for (Map.Entry<String, Object> entry : example.entrySet()) {

            String key = entry.getKey();
            Object val = entry.getValue();

            // 🔥 Build nested key (queryBody.sample)
            String paramName = parent.isEmpty() ? key : parent + "." + key;

            ToolParameter param = new ToolParameter();
           
            param.setName(paramName);
            param.setParamIn("body");
            param.setRequired(false);

            // ==========================
            // 🔥 Detect Type
            // ==========================
            if (val instanceof String) {
                param.setType("string");

            } else if (val instanceof Integer) {
                param.setType("integer");

            } else if (val instanceof Boolean) {
                param.setType("boolean");

            } else if (val instanceof Double || val instanceof Float) {
                param.setType("number");

            } else if (val instanceof Map) {
                param.setType("object");

                // ✅ Add parent object also (queryBody)
                param.setExample("{}");
                param.setDescription("Object (derived from example)");
                paramList.add(param);

                // 🔥 RECURSION for nested fields
                extractFromExample(
                        (Map<String, Object>) val,
                        paramList,
                        paramName
                );

                continue; // ⚠️ avoid duplicate add

            } else if (val instanceof List) {
                param.setType("array");

            } else {
                param.setType("string");
            }

            // ==========================
            // ✅ Set Example
            // ==========================
            param.setExample(val != null ? val.toString() : "");

            param.setDescription("Derived from example");

            paramList.add(param);
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
