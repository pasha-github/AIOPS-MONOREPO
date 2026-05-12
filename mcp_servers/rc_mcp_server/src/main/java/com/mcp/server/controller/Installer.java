package com.mcp.server.controller;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;

@RestController
public class Installer {
	
	

//	    @GetMapping("/install")
//	    public void install(
//	            @RequestParam String tenant_id,
//	            @RequestParam String env_log_path,
//	            @RequestParam String os,
//	            HttpServletResponse response) throws IOException {
//
//	        String script;
//	        env_log_path = env_log_path.replace("/", "\\");
//	        if ("windows".equalsIgnoreCase(os)) {
//
//	            response.setContentType("application/octet-stream");
//	            response.setHeader("Content-Disposition", "attachment; filename=install.ps1");
//
//	            script =
//	                "$tenantId = \"" + tenant_id + "\"\n" +
//	                "$logPath = \"" + env_log_path + "\"\n" +
//	                "$folderPath = Split-Path $logPath\n" +
//	                "$fileName = Split-Path $logPath -Leaf\n\n" +
//
//	                "Write-Host \"Starting Filebeat installer...\"\n\n" +
//
//	                "docker rm -f filebeat-$tenantId 2>$null\n\n" +
//
//	                "docker run -d --name filebeat-$tenantId " +
//	                "-e ENV_LOG_PATH=\"/logs/$fileName\" " +
//	                "-e TENANT_ID=\"$tenantId\" " +
//	                "-v \"${folderPath}:/logs\" " +
//	                "shams2026/filebeat:1.0\n\n" +
//
//	                "Write-Host \"Installation complete\"\n" +
//	                "pause\n";
//
//	        } else {
//
//	            response.setContentType("text/plain");
//
//	            script =
//	                "#!/bin/bash\n" +
//	                "TENANT_ID=\"" + tenant_id + "\"\n" +
//	                "LOG_PATH=\"" + env_log_path + "\"\n" +
//	                "FOLDER_PATH=$(dirname \"$LOG_PATH\")\n" +
//	                "FILE_NAME=$(basename \"$LOG_PATH\")\n\n" +
//
//	                "docker rm -f filebeat-$TENANT_ID\n\n" +
//
//	                "docker run -d --name filebeat-$TENANT_ID " +
//	                "-e ENV_LOG_PATH=\"/logs/$FILE_NAME\" " +
//	                "-e TENANT_ID=\"$TENANT_ID\" " +
//	                "-v \"$FOLDER_PATH:/logs\" " +
//	                "shams2026/filebeat:1.0\n";
//	        }
//
//	        response.getWriter().write(script);
	    
	//}
	
	
	@GetMapping("/install")
	public Map<String, String> install(
	        @RequestParam String tenant_id,
	        @RequestParam String env_log_path) {

	    Map<String, String> map = new HashMap<>();
	    map.put("tenant_id", tenant_id);
	    map.put("env_log_path", env_log_path);

	    return map;
	}
	
	@PostMapping("/install/status")
	public void status(@RequestBody Map<String, String> body) {
	    System.out.println("Install status: " + body);
	}

}
