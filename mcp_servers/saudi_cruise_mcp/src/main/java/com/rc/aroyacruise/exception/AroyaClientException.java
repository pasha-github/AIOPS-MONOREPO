package com.rc.aroyacruise.exception;

public class AroyaClientException extends RuntimeException {

    public AroyaClientException(String message) {
        super(message);
    }

    public AroyaClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
