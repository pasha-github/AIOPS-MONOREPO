package com.rc.aroyacruise.query;

import org.springframework.util.StringUtils;

import java.util.Map;

public class LoginQuery implements AroyaQuery {

    private final String role;
    private final String login;
    private final String password;
    private final String totalTimeout;
    private final String inactivityTimeout;

    public LoginQuery(String role, String login, String password, String totalTimeout, String inactivityTimeout) {
        this.role = role;
        this.login = login;
        this.password = password;
        this.totalTimeout = totalTimeout;
        this.inactivityTimeout = inactivityTimeout;
    }

    @Override
    public String query() {
        return """
                mutation Login {
                  login(
                    role: %s
                    login: "%s"
                    password: "%s"
                    totalTimeout: "%s"
                    inactivityTimeout: "%s"
                  ) {
                    sessionGUID
                    role
                    username
                    sourceCode
                    token
                    versionInfo
                    expiration {
                      timeout
                      inactivityTimeout
                      expires
                      autoExtend
                    }
                  }
                }
                """.formatted(
                escapeEnum(role),
                escape(login),
                escape(password),
                escape(totalTimeout),
                escape(inactivityTimeout)
        );
    }

    @Override
    public Map<String, Object> variables() {
        return Map.of();
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private String escapeEnum(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Role cannot be blank");
        }
        return value.trim();
    }
}
