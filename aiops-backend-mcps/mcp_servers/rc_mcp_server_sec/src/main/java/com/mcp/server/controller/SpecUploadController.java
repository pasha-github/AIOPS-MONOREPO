package com.mcp.server.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mcp.server.entity.Tool;
import com.mcp.server.entity.ToolList;
import com.mcp.server.entity.ToolParameter;
import com.mcp.server.repository.ToolRepository;

@RestController
@CrossOrigin(origins = "*")
public class SpecUploadController {

    private final ToolRepository repo;

    @Autowired
    public SpecUploadController(ToolRepository repo) {
        this.repo = repo;
    }

    
    @PostMapping("/api/mcp/save")
    public ResponseEntity<Map<String, Object>> saveNewMcpConfigurationMasterDetails(@RequestBody ToolList newMcpPayload) {
        Map<String, Object> responseMap = new HashMap<>();
        try {
            String specUrl = newMcpPayload.getSpecUrl();
            List<String> toolNames = new ArrayList<>();

            if (specUrl != null && !specUrl.trim().isEmpty()) {
                ObjectMapper mapper = new ObjectMapper();
                Map<String, Object> swagger = mapper.readValue(new java.net.URL(specUrl), Map.class);

                toolNames = parseAndSaveTools(
                    swagger,
                    newMcpPayload.getBaseUrl(),
                    newMcpPayload.getTenantId(),
                    newMcpPayload.getConnectorId(),
                    newMcpPayload.getConnectorName(),
                    newMcpPayload.getSpecUrl(),
                    newMcpPayload.getDescription()
                );
            }

            responseMap.put("connectorId", newMcpPayload.getConnectorId());
            responseMap.put("toolsCount", toolNames.size());
            return ResponseEntity.ok(responseMap);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
    @GetMapping("/api/mcp/list")
    public List<Map<String, Object>> getAllMcps() {
        List<Tool> allTools = repo.findAll();

        Map<String, List<Tool>> groupedByConnector = allTools.stream()
            .collect(Collectors.groupingBy(Tool::getConnectorId));

        List<Map<String, Object>> result = new ArrayList<>();
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
            row.put("toolsCount", first.getToolCount());
            row.put("url", "https://rc-mcp-server-sec-428716175586.us-central1.run.app/" + first.getTenantId() + "/" + connectorId + "/mcp");
            row.put("toolname", first.getToolName());

            result.add(row);
        }
        return result;
    }

    @Transactional
    @DeleteMapping("/api/mcp/delete/{connectorId}")
    public ResponseEntity<Map<String, Object>> deleteMcpRegistrationInstance(@PathVariable String connectorId) {
        Map<String, Object> responseMap = new HashMap<>();
        try {
            List<Tool> tools = repo.findByConnectorId(connectorId);
            if (tools == null || tools.isEmpty()) {
                responseMap.put("status", "error");
                responseMap.put("message", "Target configuration entry not found in records registry!");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(responseMap);
            }

            repo.deleteByConnectorId(connectorId);

            responseMap.put("status", "success");
            responseMap.put("message", "Record deleted successfully");
            return ResponseEntity.ok(responseMap);

        } catch (Exception e) {
            responseMap.put("status", "error");
            responseMap.put("message", "Failed to clear target row parameters sequence: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(responseMap);
        }
    }

    @PostMapping("/SpecUpload")
    public Map<String, Object> uploadSwaggerFromUrl(@RequestBody Map<String, String> request) {
        try {
            String orgKey = request.get("orgKey");
            String connectorId = request.get("connectorId");
            String url = request.get("url");
            String customBaseUrl = request.get("baseUrl");
            String connectorName = request.get("connectorName");
            String specUrl = url;
            String description = request.get("description");

            if (orgKey == null || orgKey.isEmpty()) orgKey = "";
            if (url == null || url.isEmpty() || url.contains("null")) url = "";
            if (customBaseUrl == null || customBaseUrl.isEmpty()) customBaseUrl = "";
            if (connectorName == null) connectorName = "";
            if (description == null) description = "";

            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> swagger = mapper.readValue(new java.net.URL(url), Map.class);

            parseAndSaveTools(swagger, customBaseUrl, orgKey, connectorId, connectorName, specUrl, description);

            List<Tool> tools = repo.findByOrgKeyAndConnectorId(orgKey, connectorId);
            List<String> toolNames = new ArrayList<>();

            if (tools != null && !tools.isEmpty()) {
                for (Tool tool : tools) {
                    toolNames.add(tool.getToolName());
                }
            } else {
                List<Tool> fallbackToolsList = repo.findByConnectorId(connectorId);
                if (fallbackToolsList != null) {
                    for (Tool t : fallbackToolsList) {
                        toolNames.add(t.getToolName());
                    }
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("mcp_url", "https://rc-mcp-server-sec-428716175586.us-central1.run.app/" + orgKey + "/" + connectorId + "/mcp");
            response.put("tool_count", toolNames.size());
            response.put("tools", toolNames);
            return response;

        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("message", "Tools Already Exist or Something went Wrong!");
            return error;
        }
    }
    public List<String> parseAndSaveTools(Map<String, Object> swagger, String baseUrl, String tenantId,
            String connectorId, String connectorName, String specUrl, String description) {

        Map<String, Object> paths = (Map<String, Object>) swagger.get("paths");
        List<String> collectedToolNames = new ArrayList<>();

        if (paths != null) {
            for (String path : paths.keySet()) {
                Map<String, Object> methods = (Map<String, Object>) paths.get(path);
                for (String method : methods.keySet()) {
                    String toolName = path.substring(path.lastIndexOf("/") + 1).replaceAll("[{}]", "");
                    if (toolName.isEmpty()) toolName = "root";
                    if (!collectedToolNames.contains(toolName)) collectedToolNames.add(toolName);
                }
            }
        }
        Tool tool = new Tool();
        tool.setToolName(String.join(",", collectedToolNames));
        tool.setMethod("GET");
        tool.setOrgKey(tenantId);
        tool.setConnectorId(connectorId);
        tool.setConnectorName(connectorName);
        tool.setBaseUrl(baseUrl);
        tool.setSpecUrl(specUrl);
        tool.setDescription(description);
        tool.setTenantId(tenantId);
        tool.setToolCount(collectedToolNames.size());

        repo.save(tool);

        return collectedToolNames;
    }
    private List<ToolParameter> extractParametersFromOperation(Map<String, Object> operation) {
        List<ToolParameter> paramList = new ArrayList<>();
        if (operation == null) return paramList;

        List<Map<String, Object>> parameters = (List<Map<String, Object>>) operation.get("parameters");
        if (parameters != null) {
            for (Map<String, Object> p : parameters) {
                ToolParameter param = new ToolParameter();
                param.setName((String) p.get("name"));
                param.setParamIn((String) p.get("in"));
                param.setRequired(Boolean.TRUE.equals(p.get("required")));
                param.setDescription((String) p.getOrDefault("description", ""));

                Map<String, Object> schema = (Map<String, Object>) p.get("schema");
                param.setType(schema != null ? (String) schema.getOrDefault("type", "string") : "string");
                param.setExample(schema != null && schema.get("example") != null ? schema.get("example").toString() : "");

                paramList.add(param);
            }
        }

        Map<String, Object> requestBody = (Map<String, Object>) operation.get("requestBody");
        if (requestBody != null) {
            Map<String, Object> content = (Map<String, Object>) requestBody.get("content");
            if (content != null) {
                Map<String, Object> jsonContent = (Map<String, Object>) content.get("application/json");
                if (jsonContent != null) {
                    Map<String, Object> schema = (Map<String, Object>) jsonContent.get("schema");
                    if (schema != null) {
                        Map<String, Object> properties = (Map<String, Object>) schema.get("properties");
                        if (properties != null) {
                            for (Map.Entry<String, Object> entry : properties.entrySet()) {
                                Map<String, Object> propDetails = (Map<String, Object>) entry.getValue();
                                ToolParameter param = new ToolParameter();
                                param.setName(entry.getKey());
                                param.setParamIn("body");
                                param.setRequired(false);
                                param.setType((String) propDetails.getOrDefault("type", "string"));
                                param.setDescription((String) propDetails.getOrDefault("description", ""));
                                param.setExample(propDetails.get("example") != null ? propDetails.get("example").toString() : "");
                                paramList.add(param);
                            }
                        }
                    }
                }
            }
        }

        return paramList;
    }
    @PostMapping("/api/mcp/extract-base-url")
    public Map<String, Object> extractBaseUrl(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        try {
            String specUrl = request.get("specUrl");
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> swagger = mapper.readValue(new java.net.URL(specUrl), Map.class);

            List<Map<String, Object>> servers = (List<Map<String, Object>>) swagger.get("servers");
            if (servers != null && !servers.isEmpty()) {
                response.put("baseUrl", servers.get(0).get("url"));
            } else {
                response.put("baseUrl", null);
            }
        } catch (Exception e) {
            response.put("baseUrl", null);
            response.put("error", e.getMessage());
        }
        return response;
    }
    @PostMapping("/editToolName")
    public Map<String, Object> editToolName(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        Long id = Long.valueOf(request.get("id").toString());
        String toolName = request.get("toolName").toString();

        Tool tool = repo.findById(id).orElse(null);
        if (tool == null) {
            response.put("message", "Tool Not Found");
            return response;
        }

        if (tool.getToolName().equalsIgnoreCase(toolName)) {
            response.put("message", "ToolName already updated successfully");
            return response;
        }

        tool.setToolName(toolName);
        repo.save(tool);
        response.put("message", "Tool Name Updated Successfully");
        response.put("updatedToolName", tool.getToolName());
        return response;
    }

    @PostMapping("/deleteTool")
    public Map<String, Object> deleteTool(@RequestBody Map<String, Object> request) {
        Map<String, Object> response = new HashMap<>();
        Long id = Long.valueOf(request.get("id").toString());

        Tool tool = repo.findById(id).orElse(null);
        if (tool == null) {
            response.put("message", "Tool Not Found");
            return response;
        }

        repo.delete(tool);
        response.put("message", "Tool Deleted Successfully");
        return response;
    }
    @Transactional
    @PostMapping("/deleteConnector")
    public Map<String, Object> deleteConnector(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        String connectorId = request.get("connectorId").toString();

        List<Tool> tools = repo.findByConnectorId(connectorId);
        if (tools == null || tools.isEmpty()) {
            response.put("message", "Connector Not Found");
            return response;
        }

        repo.deleteByConnectorId(connectorId);
        response.put("message", "Connector Deleted Successfully");
        return response;
    }
    @GetMapping("/api/mcp/tools/{connectorId}")
    public ResponseEntity<List<String>> getToolsByConnectorId(@PathVariable String connectorId) {
        List<Tool> tools = repo.findByConnectorId(connectorId);

        List<String> toolNames = tools.stream()
                                      .map(Tool::getToolName)
                                      .distinct()
                                      .toList();

        return ResponseEntity.ok(toolNames);
    }
    @GetMapping("/api/mcp/toolDetails/{connectorId}")
    public ResponseEntity<List<Tool>> getToolDetailsByConnectorId(@PathVariable String connectorId) {
        List<Tool> tools = repo.findByConnectorId(connectorId);
        return ResponseEntity.ok(tools);
    }
}
