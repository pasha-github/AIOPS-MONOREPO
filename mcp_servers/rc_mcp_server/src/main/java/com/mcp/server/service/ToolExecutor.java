package com.mcp.server.service;

import com.mcp.server.entity.Tool;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class ToolExecutor {

    private final RestTemplate restTemplate = new RestTemplate();

    public Object executeTool(Tool tool, Map<String, Object> params) {

        String url = tool.getEndpoint();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(params, headers);

        ResponseEntity<Object> response =
                restTemplate.exchange(url, HttpMethod.POST, request, Object.class);

        return response.getBody();
    }
}