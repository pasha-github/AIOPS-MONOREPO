package com.rc.aroyacruise.dto.external;

public record LoginResultDto(
        String sessionGUID,
        String role,
        String username,
        String sourceCode,
        String token,
        String versionInfo,
        ExpirationDto expiration
) {
}