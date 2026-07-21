package com.rc.aroyacruise;

import com.rc.aroyacruise.config.AroyaApiProperties;
import com.rc.aroyacruise.config.AroyaNodeApiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({AroyaApiProperties.class,
        AroyaApiProperties.class,
        AroyaNodeApiProperties.class
})
public class AroyacruiseApplication {

	public static void main(String[] args) {
		SpringApplication.run(AroyacruiseApplication.class, args);
	}

}
