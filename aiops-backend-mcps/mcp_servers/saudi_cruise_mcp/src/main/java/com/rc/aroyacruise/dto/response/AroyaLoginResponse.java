package com.rc.aroyacruise.dto.response;


import com.rc.aroyacruise.dto.external.ExpirationDto;

public record AroyaLoginResponse(
        String sessionGUID,
        String role,
        String username,
        String sourceCode,
        String token,
        String accessToken,
        String versionInfo,
        String serverTime,
        String seawareVersion,
        ExpirationDto expiration
) {
}
