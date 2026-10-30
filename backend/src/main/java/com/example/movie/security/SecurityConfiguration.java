package com.example.movie.security;

import com.example.movie.service.AccountService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl,
            ObjectProvider<ClientRegistrationRepository> registrationRepositoryProvider,
            OAuth2UserService<OidcUserRequest, OidcUser> allowlistedOidcUserService,
            AuthenticationFailureHandler oauthFailureHandler,
            CsrfTokenRepository csrfTokenRepository) throws Exception {
        boolean googleOAuthConfigured = registrationRepositoryProvider.getIfAvailable() != null;

        http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/oauth2/**",
                                "/login/oauth2/**",
                                "/api/auth/csrf",
                                "/error")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID", "XSRF-TOKEN")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpStatus.NO_CONTENT.value())))
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint((request, response, exception) -> {
                    String path = request.getRequestURI();
                    if (path.startsWith("/api/")) {
                        response.setStatus(HttpStatus.UNAUTHORIZED.value());
                        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        response.getWriter().write("{\"error\":\"authentication_required\"}");
                    } else if (googleOAuthConfigured) {
                        response.sendRedirect("/oauth2/authorization/google");
                    } else {
                        response.sendError(HttpStatus.UNAUTHORIZED.value());
                    }
                }));

        if (googleOAuthConfigured) {
            http.oauth2Login(oauth2 -> oauth2
                    .userInfoEndpoint(userInfo -> userInfo.oidcUserService(allowlistedOidcUserService))
                    .failureHandler(oauthFailureHandler)
                    .defaultSuccessUrl(frontendUrl, true));
        }

        return http.build();
    }

    @Bean
    OAuth2UserService<OidcUserRequest, OidcUser> allowlistedOidcUserService(
            GoogleAccountAllowlist allowlist,
            AccountService accountService) {
        OidcUserService delegate = new OidcUserService();
        return userRequest -> {
            OidcUser user = delegate.loadUser(userRequest);
            if (!Boolean.TRUE.equals(user.getEmailVerified()) || !allowlist.allows(user.getEmail())) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("access_denied"), "Google account is not authorized");
            }
            accountService.getOrCreate(user);
            return user;
        };
    }

    @Bean
    AuthenticationFailureHandler oauthFailureHandler(
            @Value("${app.frontend-url:http://localhost:4200}") String frontendUrl) {
        return (request, response, exception) -> {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }

            boolean accessDenied = exception instanceof OAuth2AuthenticationException oauthException
                    && "access_denied".equals(oauthException.getError().getErrorCode());
            String error = accessDenied ? "access_denied" : "sign_in_failed";
            response.sendRedirect(frontendUrl + "?authError=" + error);
        };
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository(
            @Value("${app.security.session-cookie-secure:true}") boolean secureCookie) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie
                .path("/")
                .secure(secureCookie)
                .sameSite("Lax"));
        return repository;
    }
}

