package com.example.movie.config;

import java.time.Duration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(TmdbProperties.class)
public class TmdbConfiguration {

    @Bean
    RestClient tmdbRestClient(TmdbProperties properties) {
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(4));

        var clientBuilder = RestClient.builder()
                .baseUrl("https://api.themoviedb.org/3")
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        if (properties.isConfigured()) {
            clientBuilder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.accessToken());
        }
        return clientBuilder.build();
    }
}
