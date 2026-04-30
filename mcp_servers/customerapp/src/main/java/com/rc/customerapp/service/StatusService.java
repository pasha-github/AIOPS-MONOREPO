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
    }

    public void setStop() {
        Status oldStatus = globalStatus.getAndSet(Status.STOP);

        if (oldStatus == Status.START) {
            log.info("Status changed from start to stop");
        }
    }

    public Status getStatus() {
        return globalStatus.get();
    }
}
