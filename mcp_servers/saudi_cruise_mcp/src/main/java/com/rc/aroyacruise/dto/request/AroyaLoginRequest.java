package com.rc.aroyacruise.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AroyaLoginRequest(
        @NotBlank String role,
        @NotBlank String login,
        @NotBlank String password,
        @NotBlank String totalTimeout,
        @NotBlank String inactivityTimeout
) {
}
