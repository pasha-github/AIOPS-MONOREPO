package com.rc.aroyacruise.mapper;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@Component
public class NodeAvailableVoyagesMarkdownMapper {

    public String toMarkdown(JsonNode data) {
        if (isMessageResponse(data)) {
            return text(data.path("message"));
        }

        JsonNode results = data
                .path("availableVoyages")
                .path("results");

        if (!results.isArray() || results.size() == 0) {
            return "voyages of that dates and destionation not available please try another date";
        }

        StringBuilder markdown = new StringBuilder();

        markdown.append("Available voyages\n\n");

        for (JsonNode voyage : results) {
            JsonNode pkg = voyage.path("pkg");
            JsonNode cms = pkg.path("type").path("cms");

            markdown.append("### ")
                    .append(valueOrDash(text(cms.path("title"))))
                    .append("\n");

            markdown.append("**Package Key**: ")
                    .append(valueOrDash(text(pkg.path("key"))))
                    .append("  \n");

            markdown.append("**Duration**: ")
                    .append(valueOrDash(text(cms.path("duration"))))
                    .append("  \n");

            markdown.append("**Description**: ")
                    .append(valueOrDash(text(cms.path("description"))))
                    .append("  \n");

            markdown.append("**Cabin Categories**: ")
                    .append(valueOrDash(cabinCategories(voyage.path("availableCategories"))))
                    .append("  \n");

            markdown.append("**Itinerary**: ")
                    .append(valueOrDash(itinerary(voyage.path("sailActivities"))))
                    .append("\n\n");
        }

        return markdown.toString().trim();
    }

    private boolean isMessageResponse(JsonNode data) {
        return data.path("success").isBoolean()
                && !data.path("success").asBoolean()
                && !text(data.path("message")).isBlank();
    }

    private String cabinCategories(JsonNode availableCategories) {
        if (!availableCategories.isArray() || availableCategories.size() == 0) {
            return "";
        }

        List<String> values = new ArrayList<>();

        for (JsonNode category : availableCategories) {
            String description = text(category.path("description"));
            String capacity = text(category.path("capacity"));
            String price = text(category.path("price").path("total"));
            String currency = text(category.path("price").path("currency").path("key"));

            StringBuilder value = new StringBuilder();

            if (!description.isBlank()) {
                value.append(description);
            }

            if (!capacity.isBlank()) {
                if (!value.isEmpty()) {
                    value.append(" - ");
                }

                value.append("Capacity: ").append(capacity);
            }

            if (!price.isBlank()) {
                if (!value.isEmpty()) {
                    value.append(" - ");
                }

                value.append("Price: ").append(price);

                if (!currency.isBlank()) {
                    value.append(" ").append(currency);
                }
            }

            if (!value.isEmpty()) {
                values.add(value.toString());
            }
        }

        return String.join("; ", values);
    }

    private String itinerary(JsonNode sailActivities) {
        if (!sailActivities.isArray() || sailActivities.size() == 0) {
            return "";
        }

        List<String> values = new ArrayList<>();

        for (JsonNode activity : sailActivities) {
            String title = text(activity.path("itineraryTitle"));
            String dateTime = text(activity.path("dateTime"));

            if (title.isBlank() && dateTime.isBlank()) {
                continue;
            }

            if (dateTime.isBlank()) {
                values.add(title);
            } else if (title.isBlank()) {
                values.add(dateTime);
            } else {
                values.add(title + " (" + dateTime + ")");
            }
        }

        return String.join("; ", values);
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
