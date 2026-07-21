package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.request.NodeGuestRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public class NodeGuestSessionStore {

    private final ConcurrentMap<String, NodeGuestRequest> guestsByClientId =
            new ConcurrentHashMap<>();

    public void save(String clientId, NodeGuestRequest guest) {
        if (!StringUtils.hasText(clientId) || guest == null) {
            return;
        }

        guestsByClientId.put(normalizeClientId(clientId), guest);
    }

    public Optional<NodeGuestRequest> findByClientId(String clientId) {
        if (!StringUtils.hasText(clientId)) {
            return Optional.empty();
        }

        return Optional.ofNullable(
                guestsByClientId.get(normalizeClientId(clientId))
        );
    }

    private String normalizeClientId(String clientId) {
        return clientId
                .trim()
                .replace("Client|", "");
    }
}