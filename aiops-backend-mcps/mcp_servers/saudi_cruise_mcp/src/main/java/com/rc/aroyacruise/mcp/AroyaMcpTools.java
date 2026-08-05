package com.rc.aroyacruise.mcp;


import com.rc.aroyacruise.dto.request.*;
import com.rc.aroyacruise.dto.response.AroyaLoginResponse;
import com.rc.aroyacruise.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.List;

@Component
@RequiredArgsConstructor
public class AroyaMcpTools {

    private final AroyaService aroyaService;
    private final NodeAroyaVoyageService voyageService;
    private final NodeAroyaGuestService nodeAroyaGuestService;
    private final NodeAroyaReservationService nodeAroyaReservationService;
    private final NodeAroyaHomePageVoyageService homePageVoyageService;
    private final NodeAroyaAddonService nodeAroyaAddonService;
    private final NodeAroyaReservationAddonService reservationAddonService;
    private final NodeAroyaShorexService nodeAroyaShorexService;
    private final NodeAroyaReservationShorexService reservationShorexService;


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

    /*@McpTool(
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
    }*/

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
        return voyageService.getAvailableVoyages(
                new NodeAvailableVoyagesRequest(
                        0,
                        10,
                        startDateFrom,
                        startDateTo,
                        destinations,
                        departurePorts
                )
        );
    }

    @McpTool(
            name = "aroya_add_guests",
            description = """
                Add one or more guests to Aroya and return the processing status and client ID for each guest.
                """
    )
    public JsonNode addGuests(

            @McpToolParam(
                    description = """
                List of guests to create in Aroya.
                Fill each guest object using the field-level descriptions and examples.
                """,
                    required = true
            )
            List<NodeGuestRequest> guests
    ) {
        return nodeAroyaGuestService.addGuests(
                new NodeAddGuestsRequest(guests)
        );
    }

    @McpTool(
            name = "aroya_create_reservation",
            description = """
                Create an Aroya cruise reservation for one or more guests and selected voyages/cabins.
                """
    )
    public JsonNode createReservation(

            @McpToolParam(
                    description = """
                Guests included in the reservation.
                Fill each guest object using the field-level descriptions and examples.
                """,
                    required = true
            )
            List<NodeReservationGuestRequest> guests,

            @McpToolParam(
                    description = """
                Voyage and cabins to reserve.
                Fill each voyage object using the field-level descriptions and examples.
                """,
                    required = true
            )
            List<NodeReservationVoyageRequest> voyages
    ) {
        return nodeAroyaReservationService.createReservation(
                new NodeCreateReservationRequest(
                        guests,
                        voyages
                ),
                null
        );
    }

    @McpTool(
            name = "aroya_get_voyages_recommendations",
            description = """
                Get recommendation voyages grouped by destination.
                It returns only the first 3 voyages for every destination to keep the response small and useful.
                """
    )
    public JsonNode getHomePageVoyages(
    ) {
        return homePageVoyageService.getHomePageVoyages(
        );
    }

    @McpTool(
            name = "aroya_get_available_addons",
            description = """
                Get available addons for an existing Aroya reservation.

                This tool calls availableAddons using reservationId.

                The response is returned in Markdown format, not JSON.

                Response includes only:
                - addon name
                - addon key
                - classification
                - component reference
                """
    )
    public String getAvailableAddons(
            @McpToolParam(
                    description = """
                        Reservation ID returned from create reservation.

                        Can be provided with or without Reservation| prefix.

                        Examples:
                        - "-21085278"
                        - "Reservation|-21085278"
                        """,
                    required = true
            )
            String reservationId

    ) {
        return nodeAroyaAddonService.getAvailableAddons(
                new NodeAvailableAddonsRequest(
                        reservationId,
                        false,
                        false
                ),
                null
        );
    }

    @McpTool(
            name = "aroya_update_reservation_addons",
            description = """
                Update addons for an existing Aroya reservation.
                Use this tool after:
                1. Creating a temporary reservation.
                2. Getting available addons using aroya_get_available_addons.
                3. Selecting addon key and component reference from the available addons response.
                """
    )
    public JsonNode updateReservationAddons(
            @McpToolParam(
                    description = """
                        Reservation ID returned from create reservation.

                        Can be provided with or without Reservation| prefix.

                        Examples:
                        - "-21578365"
                        - "Reservation|-21578365"
                        """,
                    required = true
            )
            String reservationId,

            @McpToolParam(
                    description = """
                        List of addons to add/update on the reservation.

                        Each addon object must contain:
                        - addonKey: addon key selected from available addons. Example: "MAX-BND"
                        - status: addon status. Default is "CONFIRMED"
                        - dateFrom: addon start date. Example: "2026-06-27T00:00:00"
                        - dateTo: addon end date. Example: "2026-07-04T00:00:00"
                        - quantity: quantity of addon. Default is 1
                        - guests: guest sequence numbers. Example: [1]
                        - linkedComponent: component reference from available addons response.
                        addonKey can be provided with or without Addon| prefix.
                        """,
                    required = true
            )
            List<NodeReservationAddonRequest> addons
    ) {
        return reservationAddonService.updateReservationAddons(
                new NodeReservationAddonUpdateRequest(
                        reservationId,
                        addons
                )
        );
    }

    @McpTool(
            name = "aroya_get_available_shorex",
            description = """
                Get available shore excursions for an existing Aroya reservation.

                Use this tool after creating a reservation.

                The response is returned in Markdown format.

                Response includes:
                - shorex name
                - shorex code
                - availability
                - price
                - date range
                - guest references

                Use the shorex code and guest references from this response for the next shorex update/booking step.
                """
    )
    public String getAvailableShorex(
            @McpToolParam(
                    description = """
                        Reservation ID returned from create reservation.

                        Can be provided with or without Reservation| prefix.

                        Examples:
                        - "-15391384"
                        - "Reservation|-15391384"
                        """,
                    required = true
            )
            String reservationId
    ) {
        return nodeAroyaShorexService.getAvailableShorex(
                new NodeAvailableShorexRequest(
                        reservationId,
                        true,
                        "en",
                        "website"
                ),
                null
        );
    }

    @McpTool(
            name = "aroya_update_reservation_shorex",
            description = """
                Update shore excursions for an existing Aroya reservation.

                Use this tool after:
                1. Creating a reservation.
                2. Getting available shore excursions using aroya_get_available_shorex.
                3. Selecting the shorex package key and guest sequence numbers.

                The response is returned as complete JSON from Aroya.
                """
    )
    public JsonNode updateReservationShorex(
            @McpToolParam(
                    description = """
                        Reservation ID returned from create reservation.

                        Can be provided with or without Reservation| prefix.

                        Examples:
                        - "-15602419"
                        - "Reservation|-15602419"
                        """,
                    required = true
            )
            String reservationId,

            @McpToolParam(
                    description = """
                        Whether to replace all existing shore excursions.

                        Use null if you do not want to send a value.
                        Example: null
                        """,
                    required = false
            )
            Boolean replaceAll,

            @McpToolParam(
                    description = """
                        List of shore excursions to add/update.

                        Each shorex object must contain:
                        - packageKey: shorex package key from available shorex response. Example: "BXN0228"
                        - guests: guest sequence numbers. Example: [1]
                        - bookMode: booking mode. Default is "PRE_BOOK_ONLY"
                        """,
                    required = true
            )
            List<NodeReservationShorexRequest> shorex
    ) {
        return reservationShorexService.updateReservationShorex(
                new NodeReservationShorexUpdateRequest(
                        reservationId,
                        replaceAll,
                        shorex
                ),
                null
        );
    }

}