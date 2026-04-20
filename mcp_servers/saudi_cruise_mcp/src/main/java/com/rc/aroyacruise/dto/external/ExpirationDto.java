package com.rc.aroyacruise.dto.external;

public record ExpirationDto(
        String timeout,
        String inactivityTimeout,
        String expires,
        Boolean autoExtend
) {
}
