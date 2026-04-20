package com.rc.aroyacruise.util;


import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.Iterator;
import java.util.Map;

public class Utility {
    public static JsonNode removeNulls(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }

        if (node.isObject()) {
            ObjectNode objectNode = (ObjectNode) node;
            Iterator<Map.Entry<String, JsonNode>> fields = objectNode.properties().iterator();

            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                JsonNode child = entry.getValue();

                if (child == null || child.isNull()) {
                    fields.remove();
                } else {
                    JsonNode cleanedChild = removeNulls(child);
                    if (cleanedChild == null || cleanedChild.isNull()) {
                        fields.remove();
                    }
                }
            }
            return objectNode;
        }

        if (node.isArray()) {
            ArrayNode arrayNode = (ArrayNode) node;
            for (int i = arrayNode.size() - 1; i >= 0; i--) {
                JsonNode child = arrayNode.get(i);

                if (child == null || child.isNull()) {
                    arrayNode.remove(i);
                } else {
                    JsonNode cleanedChild = removeNulls(child);
                    if (cleanedChild == null || cleanedChild.isNull()) {
                        arrayNode.remove(i);
                    }
                }
            }
            return arrayNode;
        }

        return node;
    }
}
