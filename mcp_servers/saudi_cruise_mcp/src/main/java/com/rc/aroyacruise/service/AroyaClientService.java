package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaApiProperties;
import com.rc.aroyacruise.dto.external.GraphQlError;
import com.rc.aroyacruise.dto.external.IntegrationTaskRequest;
import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.exception.AroyaClientException;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AroyaClientService {

    private final RestClient restClient;
    private final AroyaApiProperties properties;

    public AroyaClientService(RestClient restClient, AroyaApiProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    public <T> IntegrationTaskResponse<T> postIntegrationTask(
            String query,
            Map<String, Object> variables,
            String bearerToken,
            ParameterizedTypeReference<IntegrationTaskResponse<T>> responseType
    ) {
        try {
            IntegrationTaskRequest request = new IntegrationTaskRequest(
                    query,
                    variables == null ? Map.of() : variables
            );

            RestClient.RequestBodySpec spec = restClient.post()
                    .uri(properties.baseUrl() + properties.integrationTasksPath())
                    .header("client_id", properties.clientId())
                    .header("client_secret", properties.clientSecret())
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

            if (StringUtils.hasText(bearerToken)) {
                spec.header(HttpHeaders.AUTHORIZATION, buildBearerToken(bearerToken));
            }

            IntegrationTaskResponse<T> response = spec
                    .body(request)
                    .retrieve()
                    .body(responseType);

            if (response == null) {
                throw new AroyaClientException("Null response received from Aroya integration-tasks endpoint");
            }

            if (response.errors() != null && !response.errors().isEmpty()) {
                throw new AroyaClientException(extractErrors(response.errors()));
            }

            return response;
        } catch (Exception ex) {
            if (ex instanceof AroyaClientException) {
                throw ex;
            }
            throw new AroyaClientException("Failed to call Aroya integration-tasks endpoint", ex);
        }
    }

    private String buildBearerToken(String token) {
        return token.startsWith("Bearer ") ? token : "Bearer " + token;
    }

    private String extractErrors(List<GraphQlError> errors) {
        return errors.stream()
                .map(GraphQlError::message)
                .collect(Collectors.joining(" | "));
    }
}
