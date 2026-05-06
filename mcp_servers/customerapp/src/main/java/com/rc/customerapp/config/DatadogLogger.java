package com.rc.customerapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;


@Component
public class DatadogLogger {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${DD_API_KEY}")
    private String apiKey;

    public void send(String message, String status) {
        String url = "https://http-intake.logs.us5.datadoghq.com/v1/input";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.add("DD-API-KEY", apiKey);

        Map<String, Object> payload = new HashMap<>();
        payload.put("service", "customer-app");
        payload.put("host", "customer-app");
        payload.put("ddsource", "java");
        payload.put("message", message);
        payload.put("status", status);

        HttpEntity<Map<String, Object>> request =
                new HttpEntity<>(payload, headers);

        restTemplate.postForEntity(url, request, String.class);
    }
}
