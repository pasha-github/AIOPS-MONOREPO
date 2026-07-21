package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.request.NodeCreateReservationRequest;
import com.rc.aroyacruise.dto.request.NodeReservationGuestRequest;
import com.rc.aroyacruise.dto.request.NodeReservationVoyageRequest;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class NodeReservationFallbackResponseHelper {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final String CREATE_RESERVATION_FALLBACK_FILE =
            "mock/create-reservation-response.json";

    private final ObjectMapper objectMapper;

    public boolean hasGraphQlErrors(JsonNode response) {
        JsonNode errors = response.get("errors");

        return errors != null
                && errors.isArray()
                && !errors.isEmpty();
    }

    public JsonNode fallbackCreateReservationResponse(
            NodeCreateReservationRequest request,
            String reason
    ) {
        log.warn(
                "Returning create reservation fallback response from file. reason={}, file={}, guestsCount={}, voyagesCount={}",
                reason,
                CREATE_RESERVATION_FALLBACK_FILE,
                request.guests() == null ? 0 : request.guests().size(),
                request.voyages() == null ? 0 : request.voyages().size()
        );

        JsonNode fallbackResponse = loadFallbackResponseFromFile(reason);

        JsonNode updatedResponse = updateResponseFromRequest(
                fallbackResponse,
                request
        );

        return Utility.removeNulls(updatedResponse);
    }

    private JsonNode loadFallbackResponseFromFile(String reason) {
        try (InputStream inputStream =
                     new ClassPathResource(CREATE_RESERVATION_FALLBACK_FILE)
                             .getInputStream()) {

            JsonNode root = objectMapper.readTree(inputStream);

            if (root == null || root.isNull() || root.isMissingNode()) {
                log.warn(
                        "Create reservation fallback file is empty. reason={}, file={}",
                        reason,
                        CREATE_RESERVATION_FALLBACK_FILE
                );

                return generatedFallbackResponse();
            }

            return root.deepCopy();

        } catch (IOException exception) {
            log.error(
                    "Failed to load create reservation fallback response file. reason={}, file={}",
                    reason,
                    CREATE_RESERVATION_FALLBACK_FILE,
                    exception
            );

            return generatedFallbackResponse();
        }
    }

    private JsonNode updateResponseFromRequest(
            JsonNode response,
            NodeCreateReservationRequest request
    ) {
        if (!(response instanceof ObjectNode responseObject)) {
            return response;
        }

        updateReservationGuests(responseObject, request.guests());
        updateSelectedVoyages(responseObject, request.voyages());

        return responseObject;
    }

    private void updateReservationGuests(
            ObjectNode responseObject,
            List<NodeReservationGuestRequest> requestGuests
    ) {
        if (requestGuests == null || requestGuests.isEmpty()) {
            return;
        }

        JsonNode result = responseObject
                .path("reservationCreate")
                .path("result");

        if (!(result instanceof ObjectNode resultObject)) {
            return;
        }

        resultObject.put("guestCount", requestGuests.size());

        JsonNode guestsNode = resultObject.path("guests");

        if (!guestsNode.isArray()) {
            return;
        }

        ArrayNode responseGuests = (ArrayNode) guestsNode;

        for (int i = 0; i < requestGuests.size() && i < responseGuests.size(); i++) {
            NodeReservationGuestRequest requestGuest = requestGuests.get(i);
            JsonNode responseGuestNode = responseGuests.get(i);

            if (!(responseGuestNode instanceof ObjectNode responseGuest)) {
                continue;
            }

            responseGuest.put("seqN", requestGuest.seqN());

            JsonNode clientNode = responseGuest.path("client");

            if (clientNode instanceof ObjectNode clientObject) {
                clientObject.put(
                        "key",
                        normalizeClientIdWithoutPrefix(requestGuest.clientId())
                );
            }
        }
    }

    private void updateSelectedVoyages(
            ObjectNode responseObject,
            List<NodeReservationVoyageRequest> requestVoyages
    ) {
        if (requestVoyages == null || requestVoyages.isEmpty()) {
            return;
        }

        JsonNode selectedVoyagesNode = responseObject.path("selectedVoyages");

        if (!selectedVoyagesNode.isArray()) {
            return;
        }

        ArrayNode selectedVoyages = (ArrayNode) selectedVoyagesNode;

        for (int i = 0; i < requestVoyages.size() && i < selectedVoyages.size(); i++) {
            NodeReservationVoyageRequest requestVoyage = requestVoyages.get(i);
            JsonNode selectedVoyageNode = selectedVoyages.get(i);

            if (!(selectedVoyageNode instanceof ObjectNode selectedVoyage)) {
                continue;
            }

            selectedVoyage.put("cabinSeqN", requestVoyage.cabinSeqN());
            selectedVoyage.put("packageKey", requestVoyage.packageKey());
            selectedVoyage.put("categoryKey", requestVoyage.categoryKey());
            selectedVoyage.put(
                    "availability",
                    defaultAvailability(requestVoyage.availability())
            );
            selectedVoyage.set(
                    "guests",
                    JSON.pojoNode(requestVoyage.guests())
            );

            updateVoyageDetailsPackageKey(
                    selectedVoyage,
                    requestVoyage.packageKey()
            );

            updateCabinDetailsCategoryKey(
                    selectedVoyage,
                    requestVoyage.categoryKey()
            );
        }
    }

    private void updateVoyageDetailsPackageKey(
            ObjectNode selectedVoyage,
            String packageKey
    ) {
        JsonNode voyageDetailsNode = selectedVoyage.path("voyageDetails");

        if (voyageDetailsNode instanceof ObjectNode voyageDetails) {
            voyageDetails.put("key", packageKey);
        }
    }

    private void updateCabinDetailsCategoryKey(
            ObjectNode selectedVoyage,
            String categoryKey
    ) {
        JsonNode cabinDetailsNode = selectedVoyage.path("cabinDetails");

        if (cabinDetailsNode instanceof ObjectNode cabinDetails) {
            cabinDetails.put("categoryKey", categoryKey);

            JsonNode selectedCategoryNode = cabinDetails.path("selectedCategory");

            if (selectedCategoryNode instanceof ObjectNode selectedCategory) {
                JsonNode cabinCategoryNode = selectedCategory.path("cabinCategory");

                if (cabinCategoryNode instanceof ObjectNode cabinCategory) {
                    cabinCategory.put("key", categoryKey);
                }
            }
        }
    }

    private JsonNode generatedFallbackResponse() {
        ObjectNode response = JSON.objectNode();

        ObjectNode reservationCreate = JSON.objectNode();
        reservationCreate.set("errors", JSON.arrayNode());

        ObjectNode result = JSON.objectNode();
        result.put("key", "-17279160");
        result.put("id", "Reservation|-17279160");
        result.put("guid", "5B91AF51-4FD1-4F5A-836A-045E3B51409A");
        result.put("initialDate", "2026-06-24T12:28:29");

        ObjectNode status = JSON.objectNode();
        status.put("name", "SHOPPING");
        result.set("status", status);

        result.put("sourceCode", "NEWINT-CON");
        result.set("guests", JSON.arrayNode());
        result.put("guestCount", 0);
        result.set("paymentSchedule", JSON.arrayNode());
        result.set("promotions", JSON.arrayNode());
        result.set("addons", JSON.arrayNode());

        reservationCreate.set("result", result);
        response.set("reservationCreate", reservationCreate);
        response.set("selectedVoyages", JSON.arrayNode());

        return response;
    }

    private String normalizeClientIdWithoutPrefix(String clientId) {
        if (clientId == null || clientId.isBlank()) {
            return "";
        }

        return clientId
                .trim()
                .replace("Client|", "");
    }

    private String defaultAvailability(String availability) {
        if (availability == null || availability.isBlank()) {
            return "OK";
        }

        return availability.trim().toUpperCase();
    }
}