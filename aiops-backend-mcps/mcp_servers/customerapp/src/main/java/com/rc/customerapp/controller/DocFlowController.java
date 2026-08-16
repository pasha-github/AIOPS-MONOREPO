package com.rc.customerapp.controller;

import java.io.IOException;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class DocFlowController {

    /** Stored attachments live under src/main/resources/attachments/{docNo}/. */
    private static final String ATTACHMENT_ROOT = "attachments/";

    /**
     * GET /doc-flow
     * Serves the bundled DocFlow page from static resources.
     */
    @GetMapping("/doc-flow")
    public String docFlow() {
        return "forward:/doc-flow.html";
    }

    /**
     * GET /doc-flow/attachments/view
     * Streams the stored PDF inline, so the URL opens in a browser and can be
     * shared as-is.
     */
    @GetMapping("/doc-flow/attachments/view")
    public ResponseEntity<Resource> viewAttachment(
            @RequestParam String docNo,
            @RequestParam String fileName) {
        return serve(docNo, fileName, false);
    }

    /**
     * GET /doc-flow/attachments/download
     * The same stored PDF as the view URL, returned as a download.
     */
    @GetMapping("/doc-flow/attachments/download")
    public ResponseEntity<Resource> downloadAttachment(
            @RequestParam String docNo,
            @RequestParam String fileName) {
        return serve(docNo, fileName, true);
    }

    /**
     * Streams a stored attachment, or 404s when none exists — a missing file is
     * never substituted with generated content.
     */
    private ResponseEntity<Resource> serve(String docNo, String fileName, boolean asDownload) {
        String safeDocNo = sanitize(docNo);
        String safeFileName = sanitize(fileName);
        if (safeDocNo.isEmpty() || !safeFileName.toLowerCase().endsWith(".pdf")) {
            return ResponseEntity.notFound().build();
        }

        Resource pdf = new ClassPathResource(ATTACHMENT_ROOT + safeDocNo + "/" + safeFileName);
        if (!pdf.exists() || !pdf.isReadable()) {
            return ResponseEntity.notFound().build();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition((asDownload
                ? ContentDisposition.attachment()
                : ContentDisposition.inline())
                .filename(safeFileName)
                .build());
        try {
            headers.setContentLength(pdf.contentLength());
        } catch (IOException e) {
            // Optional header; the body still streams correctly without it.
        }

        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    /**
     * Reduces a parameter to one safe path segment: no separators, no traversal,
     * no leading dot. Returns "" if anything unexpected is present.
     */
    private String sanitize(String value) {
        if (value == null) {
            return "";
        }
        String name = value.trim().replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (name.isEmpty() || name.startsWith(".")) {
            return "";
        }
        for (char c : name.toCharArray()) {
            if (!Character.isLetterOrDigit(c) && c != '-' && c != '_' && c != '.' && c != ' ') {
                return "";
            }
        }
        return name;
    }
}
