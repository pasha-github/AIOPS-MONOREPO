package com.mcp.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;


@SpringBootApplication
public class McpServerApplication {
 public static void main(String[] args) {
  SpringApplication.run(McpServerApplication.class, args);
 }
}
