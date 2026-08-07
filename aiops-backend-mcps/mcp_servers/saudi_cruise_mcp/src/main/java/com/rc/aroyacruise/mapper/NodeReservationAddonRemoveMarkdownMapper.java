package com.rc.aroyacruise.mapper;

import com.rc.aroyacruise.dto.request.NodeReservationAddonRemoveRequest;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@Component
public class NodeReservationAddonRemoveMarkdownMapper {

    public String toMarkdown(
            JsonNode response,
            NodeReservationAddonRemoveRequest request
    ) {
        JsonNode removeResult = response
                .path("data")
                .path("reservationAddonRemove");

        StringBuilder markdown = new StringBuilder();

        markdown.append("Reservation addon remove result\n\n");

        markdown.append("**Reservation ID**: ")
                .append(valueOrDash(request.reservationId()))
                .append("  \n");

        markdown.append("**Removed Record IDs**: ")
                .append(valueOrDash(recordIds(request.recordIds())))
                .append("  \n");

        markdown.append("**Operation Result**: ")
                .append(valueOrDash(text(removeResult.path("operationResult"))))
                .append("\n\n");

        appendErrors(markdown, response, removeResult);

        JsonNode result = removeResult.path("result");

        if (result.isMissingNode() || result.isNull()) {
            markdown.append("No reservation result returned.");
            return markdown.toString().trim();
        }

        markdown.append("**Reservation Key**: ")
                .append(valueOrDash(text(result.path("key"))))
                .append("  \n");

        markdown.append("**Status**: ")
                .append(valueOrDash(text(result.path("status").path("name"))))
                .append("  \n");

        markdown.append("**Guest Count**: ")
                .append(valueOrDash(text(result.path("guestCount"))))
                .append("  \n");

        markdown.append("**Grand Total**: ")
                .append(valueOrDash(text(result.path("invoiceTotals").path("grandTotal"))))
                .append("\n\n");

        appendRemainingAddons(markdown, result.path("addons"));

        return markdown.toString().trim();
    }

    private void appendRemainingAddons(
            StringBuilder markdown,
            JsonNode addons
    ) {
        markdown.append("Remaining addons\n\n");

        if (!addons.isArray() || addons.size() == 0) {
            markdown.append("No remaining addons found.");
            return;
        }

        for (JsonNode addonNode : addons) {
            JsonNode addon = addonNode.path("addon");

            markdown.append("### ")
                    .append(valueOrDash(text(addon.path("name"))))
                    .append("\n");

            markdown.append("**Key**: ")
                    .append(valueOrDash(text(addon.path("key"))))
                    .append("  \n");

            markdown.append("**Record ID**: ")
                    .append(valueOrDash(text(addonNode.path("recordId"))))
                    .append("  \n");

            markdown.append("**Quantity**: ")
                    .append(valueOrDash(text(addonNode.path("quantity"))))
                    .append("  \n");

            markdown.append("**Price**: ")
                    .append(valueOrDash(text(addonNode.path("price"))))
                    .append("  \n");

            markdown.append("**Mandatory**: ")
                    .append(valueOrDash(text(addonNode.path("mandatory"))))
                    .append("  \n");

            markdown.append("**Classification**: ")
                    .append(valueOrDash(classifications(addon.path("classifications"))))
                    .append("  \n");

            markdown.append("**Guest**: ")
                    .append(valueOrDash(guest(addonNode.path("guest"))))
                    .append("\n\n");
        }
    }

    private void appendErrors(
            StringBuilder markdown,
            JsonNode response,
            JsonNode removeResult
    ) {
        JsonNode graphQlErrors = response.path("errors");

        if (graphQlErrors.isArray() && graphQlErrors.size() > 0) {
            markdown.append("Errors\n\n");

            for (JsonNode error : graphQlErrors) {
                markdown.append("- ")
                        .append(valueOrDash(text(error.path("message"))))
                        .append("\n");
            }

            markdown.append("\n");
        }

        JsonNode rawErrors = removeResult.path("rawErrors");

        if (rawErrors.isArray() && rawErrors.size() > 0) {
            markdown.append("Raw Errors\n\n");

            for (JsonNode error : rawErrors) {
                markdown.append("- ")
                        .append(valueOrDash(text(error.path("message"))))
                        .append("\n");
            }

            markdown.append("\n");
        }
    }

    private String classifications(JsonNode classificationsNode) {
        if (!classificationsNode.isArray() || classificationsNode.size() == 0) {
            return "";
        }

        List<String> values = new ArrayList<>();

        for (JsonNode classification : classificationsNode) {
            String code = text(classification.path("code"));

            if (!code.isBlank()) {
                values.add(code);
            }
        }

        return String.join(", ", values);
    }

    private String guest(JsonNode guestNode) {
        String seqN = text(guestNode.path("seqN"));
        String fullName = text(guestNode.path("client").path("fullName"));

        if (seqN.isBlank() && fullName.isBlank()) {
            return "";
        }

        if (fullName.isBlank()) {
            return "Guest " + seqN;
        }

        if (seqN.isBlank()) {
            return fullName;
        }

        return "Guest " + seqN + " - " + fullName;
    }

    private String recordIds(List<Long> recordIds) {
        if (recordIds == null || recordIds.isEmpty()) {
            return "";
        }

        return recordIds
                .stream()
                .map(String::valueOf)
                .toList()
                .toString();
    }

    private String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }

        return node.asText("");
    }

    private String valueOrDash(String value) {
        if (value == null || value.isBlank()) {
            return "-";
        }

        return value
                .replace("\n", " ")
                .replace("\r", " ")
                .replace("|", "\\|")
                .trim();
    }
}
