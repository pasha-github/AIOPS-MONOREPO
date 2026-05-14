package com.rc.aroyacruise.dto.external;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ExtensionsDto(
        @JsonProperty("access_token")
        String accessToken,

        @JsonProperty("server_time")
        String serverTime,

        @JsonProperty("seaware_version")
        String seawareVersion
) {
}
