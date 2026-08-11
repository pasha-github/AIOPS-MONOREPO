package com.rc.aroyacruise.mapper;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@Component
public class NodeAvailableShorexMarkdownMapper {

    public String toMarkdown(JsonNode data) {
        JsonNode shorexList = data
                .path("availableShorex")
                .path("availableShorex");

        if (!shorexList.isArray() || shorexList.size() == 0) {
            return """
                    List of shorex

                    No available shorex found.
                    """.trim();
        }

        StringBuilder markdown = new StringBuilder();

        markdown.append("List of shorex\n\n");

        for (JsonNode shorex : shorexList) {
            markdown.append("### ")
                    .append(valueOrDash(text(shorex.path("name"))))
                    .append("\n");

            markdown.append("**Code**: ")
                    .append(valueOrDash(text(shorex.path("code"))))
                    .append("  \n");

            markdown.append("**Availability**: ")
                    .append(valueOrDash(text(shorex.path("availability"))))
                    .append("  \n");

            markdown.append("**Price**: ")
                    .append(valueOrDash(price(shorex)))
                    .append("  \n");

            markdown.append("**Date**: ")
                    .append(valueOrDash(dateRange(shorex.path("dateTimeRange"))))
                    .append("  \n");

            markdown.append("**Guests**: ")
                    .append(valueOrDash(guestRefs(shorex.path("guestRefs"))))
                    .append("\n\n");
        }

        return markdown.toString().trim();
    }

    private String price(JsonNode shorex) {
        String priceInc = text(shorex.path("priceInc"));

        if (!priceInc.isBlank()) {
            return priceInc;
        }

        return text(shorex.path("price"));
    }

    private String dateRange(JsonNode dateTimeRange) {
        String from = text(dateTimeRange.path("from"));
        String to = text(dateTimeRange.path("to"));

        if (from.isBlank() && to.isBlank()) {
            return "";
        }

        if (from.isBlank()) {
            return to;
        }

        if (to.isBlank()) {
            return from;
        }

        return from + " to " + to;
    }

    private String guestRefs(JsonNode guestRefsNode) {
        if (!guestRefsNode.isArray() || guestRefsNode.size() == 0) {
            return "";
        }

        List<String> values = new ArrayList<>();

        for (JsonNode guestRef : guestRefsNode) {
            String value = text(guestRef);

            if (!value.isBlank()) {
                values.add(value);
            }
        }

        return String.join(", ", values);
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