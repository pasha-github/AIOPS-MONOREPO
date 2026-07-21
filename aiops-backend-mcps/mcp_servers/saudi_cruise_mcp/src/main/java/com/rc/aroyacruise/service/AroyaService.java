package com.rc.aroyacruise.service;


import com.rc.aroyacruise.dto.external.IntegrationTaskResponse;
import com.rc.aroyacruise.dto.external.LoginResultDto;
import com.rc.aroyacruise.dto.external.LoginWrapperData;
import com.rc.aroyacruise.dto.request.AroyaLoginRequest;
import com.rc.aroyacruise.dto.request.AvailableVoyagesRequest;
import com.rc.aroyacruise.dto.response.AroyaLoginResponse;
import com.rc.aroyacruise.exception.AroyaClientException;
import com.rc.aroyacruise.query.*;
import com.rc.aroyacruise.util.TokenStore;
import com.rc.aroyacruise.util.Utility;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;

@Service
public class AroyaService {

    private final AroyaClientService clientService;
    private final TokenStore tokenStore;

    public AroyaService(AroyaClientService clientService, TokenStore tokenStore) {
        this.clientService = clientService;
        this.tokenStore = tokenStore;
    }

    public AroyaLoginResponse login(AroyaLoginRequest request) {
        LoginQuery loginQuery = new LoginQuery(
                request.role(),
                request.login(),
                request.password(),
                request.totalTimeout(),
                request.inactivityTimeout()
        );

        IntegrationTaskResponse<LoginWrapperData> response = clientService.postIntegrationTask(
                loginQuery.query(),
                loginQuery.variables(),
                null,
                new ParameterizedTypeReference<>() {}
        );

        if (response.data() == null || response.data().login() == null) {
            throw new AroyaClientException("Login data not found in Aroya response");
        }

        LoginResultDto login = response.data().login();

        String accessToken = response.extensions() != null ? response.extensions().accessToken() : null;
        String tokenToStore = StringUtils.hasText(accessToken) ? accessToken : login.token();

        if (StringUtils.hasText(tokenToStore)) {
            tokenStore.save(tokenToStore);
        }

        return new AroyaLoginResponse(
                login.sessionGUID(),
                login.role(),
                login.username(),
                login.sourceCode(),
                login.token(),
                accessToken,
                login.versionInfo(),
                response.extensions() != null ? response.extensions().serverTime() : null,
                response.extensions() != null ? response.extensions().seawareVersion() : null,
                login.expiration()
        );
    }

    public JsonNode getPorts() {
        return executeJsonQuery(new PortsQuery(), null);
    }

    public JsonNode getAvailableVoyages(AvailableVoyagesRequest request, String bearerToken) {
        AvailableVoyagesQuery voyagesQuery = new AvailableVoyagesQuery(
                request.startDateFrom(),
                request.startDateTo(),
                request.destinations(),
                request.departurePorts()
        );

        return executeJsonQuery(voyagesQuery, bearerToken);
    }

    public JsonNode getDestinations() {
        return executeJsonQuery(new DestinationsQuery(), null);
    }

    public JsonNode executeJsonQuery(AroyaQuery query, String bearerToken) {
        String token = resolveToken(bearerToken);

        IntegrationTaskResponse<JsonNode> response = clientService.postIntegrationTask(
                query.query(),
                query.variables(),
                token,
                new ParameterizedTypeReference<>() {}
        );

        if (response.data() == null) {
            throw new AroyaClientException("Response data not found in Aroya response");
        }

        return Utility.removeNulls(response.data());
    }

    public String resolveToken(String bearerToken) {
        if (StringUtils.hasText(bearerToken)) {
            return stripBearerPrefix(bearerToken);
        }

        return tokenStore.get()
                .filter(StringUtils::hasText)
                .orElseGet(this::loginAndStoreToken);
    }

    private String loginAndStoreToken() {
        AroyaLoginResponse loginResponse = login(new AroyaLoginRequest(
                "ResAgent",
                "LSHANKAR",
                "LSH654@@UAT",
                "PT10H",
                "PT10H"
        ));

        String token = StringUtils.hasText(loginResponse.accessToken())
                ? loginResponse.accessToken()
                : loginResponse.token();

        if (!StringUtils.hasText(token)) {
            throw new AroyaClientException("Login succeeded but no token was returned");
        }

        tokenStore.save(token);
        return token;
    }

    private String stripBearerPrefix(String token) {
        return token.startsWith("Bearer ") ? token.substring(7) : token;
    }
}