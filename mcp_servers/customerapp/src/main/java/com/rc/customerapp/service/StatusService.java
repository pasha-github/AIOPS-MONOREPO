package com.rc.customerapp.service;

import com.rc.customerapp.config.DatadogLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatusService {
    private final DatadogLogger datadogLogger;

    public enum Status {
        START, STOP, IDLE
    }

    private final AtomicReference<Status> globalStatus = new AtomicReference<>(Status.IDLE);

    public void setStart() {
        globalStatus.set(Status.START);
        log.info("Status changed to start");
        datadogLogger.send(
                "Status changed to start","info"
        );
    }

    public void setStop() {
        Status oldStatus = globalStatus.getAndSet(Status.STOP);

        if (oldStatus == Status.START) {
            log.error("Status changed from start to stop");
            datadogLogger.send(
                    "Status changed from start to stop","error"
            );
        }
    }

    public Status getStatus() {
        log.info("Current status: "+globalStatus.toString());
        datadogLogger.send(
                "Current status: "+globalStatus,"info"
        );
        return globalStatus.get();

    }
}
