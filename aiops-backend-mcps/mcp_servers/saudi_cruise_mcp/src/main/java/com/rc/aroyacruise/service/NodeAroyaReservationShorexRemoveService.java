package com.rc.aroyacruise.service;

import com.rc.aroyacruise.dto.request.NodeReservationShorexRemoveRequest;
import com.rc.aroyacruise.mapper.NodeReservationShorexRemoveMarkdownMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class NodeAroyaReservationShorexRemoveService {

    private final NodeAroyaReservationShorexRemoveJsonService jsonService;
    private final NodeReservationShorexRemoveMarkdownMapper markdownMapper;

    public String removeReservationShorex(
            NodeReservationShorexRemoveRequest request,
            String bearerToken
    ) {
        JsonNode response = jsonService.removeReservationShorexJson(
                request,
                bearerToken
        );

        return markdownMapper.toMarkdown(
                response,
                request
        );
    }
}