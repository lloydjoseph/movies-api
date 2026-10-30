package com.example.movie.security;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @GetMapping("/me")
    public AuthenticatedUser currentUser(@AuthenticationPrincipal OidcUser user) {
        return new AuthenticatedUser(user.getEmail(), user.getFullName());
    }

    public record CsrfResponse(String token, String headerName) {
    }

    public record AuthenticatedUser(String email, String name) {
    }
}
