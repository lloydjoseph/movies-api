package com.example.movie.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("tmdb")
public record TmdbProperties(String accessToken) {

    public TmdbProperties {
        accessToken = accessToken == null ? "" : accessToken.trim();
    }

    public boolean isConfigured() {
        return !accessToken.isBlank();
    }
}
