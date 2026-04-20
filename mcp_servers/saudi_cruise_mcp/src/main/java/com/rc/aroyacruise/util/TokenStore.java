package com.rc.aroyacruise.util;

import java.util.Optional;

public interface TokenStore {
    void save(String token);
    Optional<String> get();
    void clear();
}