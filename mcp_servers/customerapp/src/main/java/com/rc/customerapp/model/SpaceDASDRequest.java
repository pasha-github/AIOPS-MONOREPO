package com.rc.customerapp.model;

import lombok.Data;

@Data
public class SpaceDASDRequest {
    private String System;
    private String JobName;
    private String StepName;
    private String AbendCode;
    private String ProcLib;
    private String Reason;
}
