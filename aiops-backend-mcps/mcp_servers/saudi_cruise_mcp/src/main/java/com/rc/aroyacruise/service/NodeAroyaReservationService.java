package com.rc.aroyacruise.service;

import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import com.rc.aroyacruise.dto.request.NodeCreateReservationRequest;
import com.rc.aroyacruise.mapper.NodeReservationResponseMapper;
import com.rc.aroyacruise.query.NodeCreateReservationQuery;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NodeAroyaReservationService {

    private final RestClient restClient;
    private final AroyaNodeApiProperties properties;
    private final AroyaService aroyaService;
    private final NodeAroyaVoyageService voyageService;
    private final NodeReservationResponseMapper responseMapper;
    private final NodeGuestSessionStore guestSessionStore;
    private final NodeReservationFallbackResponseHelper fallbackResponseHelper;

    public JsonNode createReservation(
            NodeCreateReservationRequest request,
            String bearerToken
    ) {
        Map<String, JsonNode> availableVoyagesByPackageKey =
                loadSelectedAvailableVoyagesSafely(request);

        try {
            NodeCreateReservationQuery query =
                    new NodeCreateReservationQuery(request);

            Map<String, Object> body = Map.of(
                    "query", query.query(),
                    "variables", query.variables()
            );

            String token = resolveToken(bearerToken);

            JsonNode response = restClient.post()
                    .uri(properties.graphqlUrl())
                    .header(
                            HttpHeaders.CONTENT_TYPE,
                            MediaType.APPLICATION_JSON_VALUE
                    )
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .header("client_channel", "web")
                    .header("client_realtime", "true")
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                return fallbackCreateReservationResponse(
                        request,
                        availableVoyagesByPackageKey,
                        "Aroya create reservation response is null"
                );
            }

            if (fallbackResponseHelper.hasGraphQlErrors(response)) {
                return fallbackCreateReservationResponse(
                        request,
                        availableVoyagesByPackageKey,
                        "Aroya create reservation GraphQL errors: "
                                + response.get("errors")
                );
            }

            JsonNode data = response.get("data");

            if (data == null || data.isNull()) {
                return fallbackCreateReservationResponse(
                        request,
                        availableVoyagesByPackageKey,
                        "Aroya create reservation response data is missing"
                );
            }

            JsonNode reservationCreate = data.get("reservationCreate");

            if (reservationCreate == null || reservationCreate.isNull()) {
                return fallbackCreateReservationResponse(
                        request,
                        availableVoyagesByPackageKey,
                        "reservationCreate result not found in Aroya response"
                );
            }

            return Utility.removeNulls(
                    responseMapper.map(
                            reservationCreate,
                            availableVoyagesByPackageKey,
                            request,
                            guestSessionStore
                    )
            );

        } catch (Exception exception) {
            log.warn(
                    "Create reservation call failed. Returning fallback response. reason={}",
                    exception.getMessage(),
                    exception
            );

            return fallbackCreateReservationResponse(
                    request,
                    availableVoyagesByPackageKey,
                    "Create reservation API call failed: "
                            + exception.getMessage()
            );
        }
    }

    private JsonNode fallbackCreateReservationResponse(
            NodeCreateReservationRequest request,
            Map<String, JsonNode> availableVoyagesByPackageKey,
            String reason
    ) {
        return fallbackResponseHelper.fallbackCreateReservationResponse(
                request,
                reason
        );
    }

    private Map<String, JsonNode> loadSelectedAvailableVoyagesSafely(
            NodeCreateReservationRequest request
    ) {
        try {
            return loadSelectedAvailableVoyages(request);
        } catch (Exception exception) {
            log.warn(
                    "Failed to load selected available voyage details. Continuing without voyage details. reason={}",
                    exception.getMessage(),
                    exception
            );

            return Map.of();
        }
    }

    private Map<String, JsonNode> loadSelectedAvailableVoyages(
            NodeCreateReservationRequest request
    ) {
        return request.voyages()
                .stream()
                .map(voyage -> voyage.packageKey())
                .distinct()
                .collect(Collectors.toMap(
                        packageKey -> packageKey,
                        voyageService::getAvailableVoyageByPackageKey,
                        (first, second) -> first
                ));
    }

    private String resolveToken(String bearerToken) {
        if (StringUtils.hasText(bearerToken)) {
            return stripBearerPrefix(bearerToken);
        }

        return aroyaService.resolveToken(null);
    }

    private String stripBearerPrefix(String token) {
        return token.startsWith("Bearer ")
                ? token.substring(7)
                : token;
    }
}