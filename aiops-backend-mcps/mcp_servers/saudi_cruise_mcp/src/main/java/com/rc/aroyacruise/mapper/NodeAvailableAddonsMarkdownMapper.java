package com.rc.aroyacruise.mapper;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@Component
public class NodeAvailableAddonsMarkdownMapper {

    public String toMarkdown(JsonNode data) {
        JsonNode addons = data
                .path("availableAddons")
                .path("availableAddons");

        if (!addons.isArray() || addons.isEmpty()) {
            return "List of addons\n No available addons found.";
        }

        StringBuilder markdown = new StringBuilder();

        markdown.append("List of addons\n\n");

        for (JsonNode addonNode : addons) {
            JsonNode addon = addonNode.path("addon");

            String name = text(addon.path("name"));
            String key = text(addon.path("key"));
            String classification = classifications(
                    addon.path("classifications")
            );
            String reference = firstComponentReference(
                    addonNode.path("components")
            );

            markdown.append("### ")
                    .append(valueOrDash(name))
                    .append("\n");

            markdown.append("**Key**: ")
                    .append(valueOrDash(key))
                    .append("  \n");

            markdown.append("**classification**: ")
                    .append(valueOrDash(classification))
                    .append("  \n");

            markdown.append("**reference**: ")
                    .append(valueOrDash(reference))
                    .append("\n\n");
        }

        return markdown.toString().trim();
    }

    private String classifications(JsonNode classificationsNode) {
        if (!classificationsNode.isArray()
                || classificationsNode.isEmpty()) {
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

    private String firstComponentReference(JsonNode componentsNode) {
        if (!componentsNode.isArray()
                || componentsNode.isEmpty()) {
            return "";
        }

        for (JsonNode component : componentsNode) {
            String reference = text(component.path("reference"));

            if (!reference.isBlank()) {
                return reference;
            }
        }

        return "";
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

        return value;
    }
}
