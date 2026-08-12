package com.rc.aroyacruise.service;


import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.request.NodeReservationAddonRemoveRequest;
import com.rc.aroyacruise.mapper.NodeReservationAddonRemoveMarkdownMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationAddonRemoveService {

    private final NodeAroyaReservationAddonRemoveJsonService jsonService;
    private final NodeReservationAddonRemoveMarkdownMapper markdownMapper;

    public String removeReservationAddons(
            NodeReservationAddonRemoveRequest request,
            String bearerToken
    ) {

        JsonNode response = jsonService.removeReservationAddonsJson(
                request,
                bearerToken
        );

        return markdownMapper.toMarkdown(
                response,
                request
        );
    }
}
