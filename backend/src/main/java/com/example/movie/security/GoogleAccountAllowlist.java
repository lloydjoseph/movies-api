package com.example.movie.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Server-side allowlist for Google accounts permitted to use the application. */
@Component
public class GoogleAccountAllowlist {

    private final Set<String> allowedEmails;

    public GoogleAccountAllowlist(
            @Value("${app.security.allowed-google-emails:}") String configuredEmails) {
        this.allowedEmails = Arrays.stream(configuredEmails.split(","))
                .map(String::trim)
                .filter(email -> !email.isEmpty())
                .map(email -> email.toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());

    }

    public boolean allows(String email) {
        return email != null && allowedEmails.contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
