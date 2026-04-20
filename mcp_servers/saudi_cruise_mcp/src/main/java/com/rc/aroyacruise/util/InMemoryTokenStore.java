package com.rc.aroyacruise.util;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class InMemoryTokenStore implements TokenStore {

    private final AtomicReference<String> tokenRef = new AtomicReference<>();

    @Override
    public void save(String token) {
        tokenRef.set(token);
    }

    @Override
    public Optional<String> get() {
        return Optional.ofNullable(tokenRef.get());
    }

    @Override
    public void clear() {
        tokenRef.set(null);
    }
}
