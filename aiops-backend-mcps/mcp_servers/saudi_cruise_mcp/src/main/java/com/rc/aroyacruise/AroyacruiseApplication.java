package com.rc.aroyacruise;

import com.rc.aroyacruise.config.AroyaApiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AroyaApiProperties.class)
public class AroyacruiseApplication {

	public static void main(String[] args) {
		SpringApplication.run(AroyacruiseApplication.class, args);
	}

}
