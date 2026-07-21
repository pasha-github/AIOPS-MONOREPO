package com.rc.aroyacruise.mapper;

import com.rc.aroyacruise.dto.request.NodeCreateReservationRequest;
import com.rc.aroyacruise.dto.request.NodeGuestRequest;
import com.rc.aroyacruise.dto.request.NodeReservationVoyageRequest;
import com.rc.aroyacruise.service.NodeGuestSessionStore;
import com.rc.aroyacruise.util.Utility;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

@Component
public class NodeReservationResponseMapper {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final String DEFAULT_AVAILABILITY = "OK";

    public JsonNode map(
            JsonNode reservationCreate,
            Map<String, JsonNode> availableVoyagesByPackageKey,
            NodeCreateReservationRequest request,
            NodeGuestSessionStore guestSessionStore
    ) {
        ObjectNode response = JSON.objectNode();

        response.set(
                "reservationCreate",
                enrichReservationGuests(
                        clean(reservationCreate),
                        guestSessionStore
                )
        );

        response.set(
                "selectedVoyages",
                mapSelectedVoyages(
                        availableVoyagesByPackageKey,
                        request
                )
        );

        return Utility.removeNulls(response);
    }

    private ArrayNode mapSelectedVoyages(
            Map<String, JsonNode> availableVoyagesByPackageKey,
            NodeCreateReservationRequest request
    ) {
        ArrayNode selectedVoyages = JSON.arrayNode();

        request.voyages()
                .stream()
                .map(voyage ->
                        mapSelectedVoyage(
                                availableVoyagesByPackageKey,
                                voyage
                        )
                )
                .forEach(selectedVoyages::add);

        return selectedVoyages;
    }

    private ObjectNode mapSelectedVoyage(
            Map<String, JsonNode> availableVoyagesByPackageKey,
            NodeReservationVoyageRequest requestVoyage
    ) {
        ObjectNode selectedVoyage = JSON.objectNode();

        selectedVoyage.put("cabinSeqN", requestVoyage.cabinSeqN());
        selectedVoyage.put("packageKey", requestVoyage.packageKey());
        selectedVoyage.put("categoryKey", requestVoyage.categoryKey());
        selectedVoyage.put(
                "availability",
                defaultValue(
                        requestVoyage.availability(),
                        DEFAULT_AVAILABILITY
                )
        );
        selectedVoyage.set(
                "guests",
                JSON.pojoNode(requestVoyage.guests())
        );

        JsonNode availableVoyage = getAvailableVoyage(
                availableVoyagesByPackageKey,
                requestVoyage.packageKey()
        );

        if (availableVoyage == null) {
            selectedVoyage.put("detailsAvailable", false);
            selectedVoyage.put(
                    "detailsMessage",
                    "availableVoyage data not found for packageKey: "
                            + requestVoyage.packageKey()
            );
            return selectedVoyage;
        }

        selectedVoyage.put("detailsAvailable", true);

        selectedVoyage.set(
                "voyageDetails",
                clean(availableVoyage.path("pkg"))
        );

        selectedVoyage.set(
                "inventoryResult",
                clean(availableVoyage.path("inventoryResult"))
        );

        selectedVoyage.set(
                "cabinDetails",
                findSelectedCabinDetails(
                        availableVoyage.path("availableCategories"),
                        requestVoyage.categoryKey()
                )
        );

        selectedVoyage.set(
                "sailActivities",
                clean(availableVoyage.path("sailActivities"))
        );

        return selectedVoyage;
    }

    private JsonNode getAvailableVoyage(
            Map<String, JsonNode> availableVoyagesByPackageKey,
            String packageKey
    ) {
        JsonNode response = availableVoyagesByPackageKey.get(packageKey);

        if (response == null || response.isNull()) {
            return null;
        }

        JsonNode availableVoyage = response.path("availableVoyage");

        if (availableVoyage.isMissingNode() || availableVoyage.isNull()) {
            return null;
        }

        return availableVoyage;
    }

    private JsonNode findSelectedCabinDetails(
            JsonNode availableCategories,
            String categoryKey
    ) {
        if (!availableCategories.isArray()) {
            ObjectNode error = JSON.objectNode();
            error.put("detailsAvailable", false);
            error.put(
                    "detailsMessage",
                    "Available categories not found in availableVoyage response."
            );
            return error;
        }

        Optional<JsonNode> selectedCategory =
                StreamSupport.stream(
                                availableCategories.spliterator(),
                                false
                        )
                        .filter(category ->
                                categoryKey.equals(
                                        category.path("cabinCategory")
                                                .path("key")
                                                .asText()
                                )
                        )
                        .findFirst();

        if (selectedCategory.isEmpty()) {
            ObjectNode error = JSON.objectNode();
            error.put("detailsAvailable", false);
            error.put("categoryKey", categoryKey);
            error.put(
                    "detailsMessage",
                    "Selected cabin category was not found in availableVoyage response."
            );
            return error;
        }

        ObjectNode cabinDetails = JSON.objectNode();

        cabinDetails.put("detailsAvailable", true);
        cabinDetails.put("categoryKey", categoryKey);
        cabinDetails.set(
                "selectedCategory",
                clean(selectedCategory.get())
        );

        return cabinDetails;
    }

    private JsonNode enrichReservationGuests(
            JsonNode reservationCreate,
            NodeGuestSessionStore guestSessionStore
    ) {
        if (!(reservationCreate instanceof ObjectNode reservationObject)) {
            return reservationCreate;
        }

        JsonNode guests = reservationObject
                .path("result")
                .path("guests");

        if (!guests.isArray()) {
            return reservationObject;
        }

        guests.forEach(guest -> enrichGuest(guest, guestSessionStore));

        return reservationObject;
    }

    private void enrichGuest(
            JsonNode reservationGuest,
            NodeGuestSessionStore guestSessionStore
    ) {
        if (!(reservationGuest instanceof ObjectNode guestObject)) {
            return;
        }

        JsonNode clientNode = guestObject.path("client");

        if (!(clientNode instanceof ObjectNode clientObject)) {
            return;
        }

        String clientId = clientObject.path("key").asText(null);

        guestSessionStore.findByClientId(clientId)
                .ifPresent(guestDetails ->
                        addContactDetails(
                                clientObject,
                                guestDetails
                        )
                );
    }

    private void addContactDetails(
            ObjectNode clientObject,
            NodeGuestRequest guestDetails
    ) {
        clientObject.put("email", guestDetails.email());
        clientObject.put(
                "mobileNumber",
                formatMobileNumber(
                        guestDetails.intlCode(),
                        guestDetails.phone()
                )
        );
    }

    private String formatMobileNumber(
            String intlCode,
            String phone
    ) {
        String cleanIntlCode = defaultValue(intlCode, "")
                .replace("+", "")
                .trim();

        String cleanPhone = defaultValue(phone, "")
                .replace(" ", "")
                .trim();

        if (cleanIntlCode.isBlank()) {
            return cleanPhone;
        }

        return "+" + cleanIntlCode + cleanPhone;
    }

    private JsonNode clean(JsonNode node) {
        if (node == null
                || node.isMissingNode()
                || node.isNull()) {
            return JSON.objectNode();
        }

        return Utility.removeNulls(node.deepCopy());
    }

    private String defaultValue(String value, String fallback) {
        return value == null || value.isBlank()
                ? fallback
                : value;
    }
}