package com.rc.aroyacruise.query;


import com.rc.aroyacruise.dto.request.NodeAddGuestsRequest;
import com.rc.aroyacruise.dto.request.NodeGuestRequest;

import java.util.LinkedHashMap;
import java.util.Map;

public class NodeAddGuestsQuery implements AroyaQuery {

    private final NodeAddGuestsRequest request;

    public NodeAddGuestsQuery(NodeAddGuestsRequest request) {
        this.request = request;
    }

    @Override
    public String query() {
        return """
                mutation ProcessGuestIdentity($guests: [JSON!]!) {
                  processGuestIdentity(guests: $guests)
                }
                """;
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of(
                "guests",
                request.guests().stream()
                        .map(this::toGuestVariables)
                        .toList()
        );
    }

    private Map<String, Object> toGuestVariables(NodeGuestRequest guestRequest) {
        Map<String, Object> guest = new LinkedHashMap<>();

        guest.put("title", guestRequest.title());
        guest.put("firstName", guestRequest.firstName());
        guest.put("lastName", guestRequest.lastName());
        guest.put("gender", guestRequest.gender());
        guest.put("email", guestRequest.email());
        guest.put("nationalityKey", guestRequest.nationalityKey());
        guest.put("nationalityName", guestRequest.nationalityName());
        guest.put("dateOfBirth", guestRequest.dateOfBirth());
        guest.put(
                "countryOfResidenceKey",
                guestRequest.countryOfResidenceKey()
        );
        guest.put(
                "countryOfResidenceName",
                guestRequest.countryOfResidenceName()
        );
        guest.put("city", guestRequest.city());
        guest.put("languageKey", guestRequest.languageKey());
        guest.put("languageName", guestRequest.languageName());
        guest.put("intlCode", guestRequest.intlCode());
        guest.put("phone", guestRequest.phone());


        return guest;
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
