package com.mcp.server.service;

import com.mcp.server.entity.Tool;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class ToolExecutor {

    private final RestTemplate restTemplate = new RestTemplate();
    
    
    public Object executeTool(Tool tool, String finalUrl, Map<String, Object> bodyParams) {

        String method = tool.getMethod().toUpperCase();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Object> response;

        // ✅ If GET → no body
        if (method.equals("GET")) {

            HttpEntity<Void> request = new HttpEntity<>(headers);

            response = restTemplate.exchange(
                    finalUrl,
                    HttpMethod.GET,
                    request,
                    Object.class
            );

        }
        // ✅ POST / PUT / PATCH → send body
        else if (method.equals("POST") || method.equals("PUT") || method.equals("PATCH")) {

            HttpEntity<Map<String, Object>> request =
                    new HttpEntity<>(bodyParams, headers);

            response = restTemplate.exchange(
                    finalUrl,
                    HttpMethod.valueOf(method),
                    request,
                    Object.class
            );

        }
        // ✅ DELETE (can have body optionally)
        else if (method.equals("DELETE")) {

            HttpEntity<Map<String, Object>> request =
                    new HttpEntity<>(bodyParams, headers);

            response = restTemplate.exchange(
                    finalUrl,
                    HttpMethod.DELETE,
                    request,
                    Object.class
            );

        }
        else {
            throw new RuntimeException("Unsupported HTTP method: " + method);
        }

        return response.getBody();
    }    

//    public Object executeTool(Tool tool, Map<String, Object> params) {
//
//        String url = tool.getEndpoint();
//        String method = tool.getMethod().toUpperCase();
//        ResponseEntity<Object> response = null;
//        HttpHeaders headers = new HttpHeaders();
//        headers.setContentType(MediaType.APPLICATION_JSON);
//
//        HttpEntity<Map<String, Object>> request = new HttpEntity<>(params, headers);
//        
//        if(method.equals("GET")){
//         response = restTemplate.exchange(url, HttpMethod.GET, request, Object.class);
//        }else if(method.equals("POST")){
//        	
//         response = restTemplate.exchange(url, HttpMethod.POST, request, Object.class);
//        }
//
//        return response.getBody();
//    }
    
    
//    public Object executeTool(Tool tool, Map<String, Object> params) {
//
//        String url = tool.getEndpoint();
//        String method = (tool.getMethod() != null) ? tool.getMethod().toUpperCase() : "GET";
//
//        HttpHeaders headers = new HttpHeaders();
//        headers.setContentType(MediaType.APPLICATION_JSON);
//
//        // Optional: add dynamic headers if your MCP tool supports it
//        if (tool.getHeaders() != null) {
//            tool.getHeaders().forEach(headers::set);
//        }
//
//        HttpMethod httpMethod;
//        try {
//            httpMethod = HttpMethod.valueOf(method);
//        } catch (IllegalArgumentException e) {
//            throw new RuntimeException("Unsupported HTTP method: " + method);
//        }
//
//        HttpEntity<?> request;
//
//        // ✅ GET → query params (NO body)
//        if (httpMethod == HttpMethod.GET) {
//
//            UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url);
//
//            if (params != null) {
//                params.forEach((key, value) -> {
//                    if (value != null) {
//                        builder.queryParam(key, value);
//                    }
//                });
//            }
//
//            url = builder.toUriString();
//            request = new HttpEntity<>(headers);
//
//        } else {
//            // ✅ POST / PUT / DELETE / PATCH → body
//            request = new HttpEntity<>(params, headers);
//        }
//
//        ResponseEntity<Object> response;
//        try {
//            response = restTemplate.exchange(url, httpMethod, request, Object.class);
//        } catch (Exception e) {
//            throw new RuntimeException("Error calling tool endpoint: " + url, e);
//        }
//
//        return response.getBody();
//    }
}