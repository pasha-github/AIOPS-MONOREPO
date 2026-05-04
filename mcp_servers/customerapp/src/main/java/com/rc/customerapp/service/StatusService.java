package com.rc.customerapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
public class StatusService {

    public enum Status {
        START, STOP, IDLE
    }

    private final AtomicReference<Status> globalStatus = new AtomicReference<>(Status.IDLE);

    public void setStart() {
        globalStatus.set(Status.START);
        log.info("Status changed to start");
    }

    public void setStop() {
        Status oldStatus = globalStatus.getAndSet(Status.STOP);

        if (oldStatus == Status.START) {
            log.error("Status changed from start to stop");
        }
    }

    public Status getStatus() {
        log.info("Current status: "+globalStatus.toString());
        return globalStatus.get();

    }
}
