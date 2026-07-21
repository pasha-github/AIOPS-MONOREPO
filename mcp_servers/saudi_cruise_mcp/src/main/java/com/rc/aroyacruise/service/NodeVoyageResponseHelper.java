package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.request.NodeAvailableVoyagesRequest;
import com.rc.aroyacruise.util.Utility;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.io.InputStream;

@Slf4j
@Component
@RequiredArgsConstructor
public class NodeVoyageResponseHelper {

    private static final JsonNodeFactory JSON = JsonNodeFactory.instance;
    private static final String AVAILABLE_VOYAGES_MOCK_FILE =
            "mock/available-voyages-response.json";

    private final ObjectMapper objectMapper;

    public boolean hasGraphQlErrors(JsonNode response) {
        JsonNode errors = response.get("errors");

        return errors != null
                && errors.isArray()
                && !errors.isEmpty();
    }

    public boolean hasAvailableVoyagesCmsData(JsonNode data) {
        JsonNode results = data
                .path("availableVoyages")
                .path("results");

        if (!results.isArray() || results.isEmpty()) {
            return false;
        }

        for (JsonNode result : results) {
            if (hasCmsData(result.path("pkg"))) {
                return true;
            }
        }

        return false;
    }

    public boolean hasAvailableVoyageCmsData(JsonNode data) {
        JsonNode availableVoyage = data.path("availableVoyage");

        if (availableVoyage.isMissingNode() || availableVoyage.isNull()) {
            return false;
        }

        return hasCmsData(availableVoyage.path("pkg"));
    }

    public JsonNode mockAvailableVoyagesResponse(
            NodeAvailableVoyagesRequest request,
            String reason
    ) {
        log.warn(
                "Sending mock availableVoyages response from file. reason={}, mockFile={}, startDateFrom={}, startDateTo={}, destinations={}, departurePorts={}",
                reason,
                AVAILABLE_VOYAGES_MOCK_FILE,
                request.startDateFrom(),
                request.startDateTo(),
                request.destinations(),
                request.departurePorts()
        );

        return loadAvailableVoyagesMockResponse();
    }

    public JsonNode mockAvailableVoyageByPackageKeyResponse(
            String packageKey,
            String reason
    ) {
        log.warn(
                "Sending mock availableVoyage response. reason={}, packageKey={}",
                reason,
                packageKey
        );

        ObjectNode data = JSON.objectNode();

        ObjectNode availableVoyage = JSON.objectNode();
        ObjectNode pkg = JSON.objectNode();
        ObjectNode type = JSON.objectNode();
        ObjectNode cms = JSON.objectNode();

        pkg.put("key", packageKey);
        cms.put("title", "Mock Aroya Cruise Voyage");
        cms.put("duration", "4 nights");

        type.set("cms", cms);
        pkg.set("type", type);

        availableVoyage.set("pkg", pkg);
        availableVoyage.set("availableCategories", JSON.arrayNode());
        availableVoyage.set("sailActivities", JSON.arrayNode());
        availableVoyage.putNull("inventoryResult");

        data.set("availableVoyage", availableVoyage);

        return Utility.removeNulls(data);
    }

    private JsonNode loadAvailableVoyagesMockResponse() {
        try (InputStream inputStream =
                     new ClassPathResource(AVAILABLE_VOYAGES_MOCK_FILE)
                             .getInputStream()) {

            JsonNode root = objectMapper.readTree(inputStream);

            JsonNode data = root.path("data");

            if (data.isMissingNode() || data.isNull()) {
                log.warn(
                        "Mock availableVoyages file does not contain data wrapper. Returning root object. mockFile={}",
                        AVAILABLE_VOYAGES_MOCK_FILE
                );

                return Utility.removeNulls(root);
            }

            return Utility.removeNulls(data);

        } catch (IOException exception) {
            log.error(
                    "Failed to load mock availableVoyages response from file. mockFile={}",
                    AVAILABLE_VOYAGES_MOCK_FILE,
                    exception
            );

            return fallbackAvailableVoyagesMockResponse();
        }
    }

    private JsonNode fallbackAvailableVoyagesMockResponse() {
        ObjectNode data = JSON.objectNode();
        ObjectNode availableVoyages = JSON.objectNode();

        availableVoyages.set("results", JSON.arrayNode());
        data.set("availableVoyages", availableVoyages);

        return data;
    }

    private boolean hasCmsData(JsonNode pkg) {
        JsonNode cms = pkg
                .path("type")
                .path("cms");

        return !cms.isMissingNode()
                && !cms.isNull()
                && hasText(cms.path("title"))
                && hasText(cms.path("duration"));
    }

    private boolean hasText(JsonNode node) {
        return node != null
                && node.isTextual()
                && !node.asText().isBlank();
    }
}