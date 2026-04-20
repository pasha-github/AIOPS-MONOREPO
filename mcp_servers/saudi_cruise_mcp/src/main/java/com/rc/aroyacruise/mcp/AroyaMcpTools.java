package com.rc.aroyacruise.mcp;


import com.rc.aroyacruise.dto.request.AroyaLoginRequest;
import com.rc.aroyacruise.dto.request.AvailableVoyagesRequest;
import com.rc.aroyacruise.dto.response.AroyaLoginResponse;
import com.rc.aroyacruise.service.AroyaService;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.List;

@Component
public class AroyaMcpTools {

    private final AroyaService aroyaService;

    public AroyaMcpTools(AroyaService aroyaService) {
        this.aroyaService = aroyaService;
    }

    /*@McpTool(
            name = "aroya_login",
            description = "Login to the Aroya reservation API and store the access token for later MCP tool calls."
    )
    public AroyaLoginResponse login(
            @McpToolParam(description = "User role, for example ResAgent", required = true) String role,
            @McpToolParam(description = "Login username", required = true) String login,
            @McpToolParam(description = "Login password", required = true) String password,
            @McpToolParam(description = "Total session timeout in ISO-8601 duration format, for example PT10H", required = true) String totalTimeout,
            @McpToolParam(description = "Inactivity timeout in ISO-8601 duration format, for example PT10H", required = true) String inactivityTimeout
    ) {
        return aroyaService.login(new AroyaLoginRequest(
                role,
                login,
                password,
                totalTimeout,
                inactivityTimeout
        ));
    }*/

    @McpTool(
            name = "aroya_get_ports",
            description = "Fetch available ports from the Aroya reservation API using the stored token."
    )
    public JsonNode getPorts() {
        return aroyaService.getPorts();
    }

    @McpTool(
            name = "aroya_get_destinations",
            description = "Fetch destinations from the Aroya reservation API using the stored token."
    )
    public JsonNode getDestinations() {
        return aroyaService.getDestinations();
    }

    @McpTool(
            name = "aroya_get_available_voyages",
            description = "Fetch available voyages for the provided date range, destinations, and departure ports using the stored token."
    )
    public JsonNode getAvailableVoyages(
            @McpToolParam(description = "Start date range from, format yyyy-MM-dd", required = true) String startDateFrom,
            @McpToolParam(description = "Start date range to, format yyyy-MM-dd", required = true) String startDateTo,
            @McpToolParam(description = "List of destination codes, for example [\"Red\", \"GUL\"]", required = true) List<String> destinations,
            @McpToolParam(description = "List of departure port codes, for example [\"SAJED\", \"AEDXB\"]", required = true) List<String> departurePorts
    ) {
        return aroyaService.getAvailableVoyages(
                new AvailableVoyagesRequest(
                        startDateFrom,
                        startDateTo,
                        destinations,
                        departurePorts
                ),null
        );
    }
}