package com.rc.aroyacruise.mapper;

import com.rc.aroyacruise.dto.request.NodeReservationShorexRemoveRequest;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.List;

@Component
public class NodeReservationShorexRemoveMarkdownMapper {

    public String toMarkdown(
            JsonNode data,
            NodeReservationShorexRemoveRequest request
    ) {
        JsonNode removeResult = data.path("reservationShorexRemove");

        StringBuilder markdown = new StringBuilder();

        markdown.append("Reservation shorex remove result\n\n");

        markdown.append("**Reservation ID**: ")
                .append(valueOrDash(request.reservationId()))
                .append("  \n");

        markdown.append("**Guests**: ")
                .append(valueOrDash(values(request.guests())))
                .append("  \n");

        markdown.append("**Package Keys**: ")
                .append(valueOrDash(values(request.packageKeys())))
                .append("  \n");

        markdown.append("**Operation Result**: ")
                .append(valueOrDash(text(removeResult.path("operationResult"))))
                .append("\n\n");

        appendErrors(markdown, removeResult);

        JsonNode result = removeResult.path("result");

        if (result.isMissingNode() || result.isNull()) {
            markdown.append("No reservation result returned.");
            return markdown.toString().trim();
        }

        markdown.append("**Reservation Key**: ")
                .append(valueOrDash(text(result.path("key"))))
                .append("  \n");

        markdown.append("**Reservation ID**: ")
                .append(valueOrDash(text(result.path("id"))))
                .append("\n\n");

        appendRemainingShorex(markdown, result.path("shorex"));

        return markdown.toString().trim();
    }

    private void appendRemainingShorex(
            StringBuilder markdown,
            JsonNode shorexList
    ) {
        markdown.append("Remaining shorex\n\n");

        if (!shorexList.isArray() || shorexList.size() == 0) {
            markdown.append("No remaining shorex found.");
            return;
        }

        for (JsonNode shorex : shorexList) {
            JsonNode pkg = shorex.path("pkg");
            JsonNode guest = shorex.path("guest");

            markdown.append("### ")
                    .append(valueOrDash(text(shorex.path("name"))))
                    .append("\n");

            markdown.append("**Code**: ")
                    .append(valueOrDash(text(shorex.path("code"))))
                    .append("  \n");

            markdown.append("**Package Key**: ")
                    .append(valueOrDash(text(pkg.path("key"))))
                    .append("  \n");

            markdown.append("**Package Name**: ")
                    .append(valueOrDash(text(pkg.path("name"))))
                    .append("  \n");

            markdown.append("**Record ID**: ")
                    .append(valueOrDash(text(shorex.path("recordId"))))
                    .append("  \n");

            markdown.append("**Status**: ")
                    .append(valueOrDash(text(shorex.path("status"))))
                    .append("  \n");

            markdown.append("**Price**: ")
                    .append(valueOrDash(text(shorex.path("price"))))
                    .append("  \n");

            markdown.append("**Date**: ")
                    .append(valueOrDash(text(shorex.path("effectiveDate"))))
                    .append("  \n");

            markdown.append("**Guest**: ")
                    .append(valueOrDash(guest(guest)))
                    .append("\n\n");
        }
    }

    private void appendErrors(
            StringBuilder markdown,
            JsonNode removeResult
    ) {
        JsonNode errors = removeResult.path("errors");

        if (!errors.isArray() || errors.size() == 0) {
            return;
        }

        markdown.append("Errors\n\n");

        for (JsonNode error : errors) {
            markdown.append("- ")
                    .append(valueOrDash(text(error.path("message"))))
                    .append(" ");

            String severity = text(error.path("severity"));

            if (!severity.isBlank()) {
                markdown.append("(")
                        .append(severity)
                        .append(")");
            }

            markdown.append("\n");
        }

        markdown.append("\n");
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

    private String values(List<?> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }

        return values.toString();
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
