package com.example.movie.controller;

import com.example.movie.dto.MovieLookupResultDto;
import com.example.movie.service.AccountService;
import com.example.movie.service.MovieLookupService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/movie-lookup")
@RequiredArgsConstructor
public class MovieLookupController {

    private final MovieLookupService service;
    private final AccountService accountService;

    @GetMapping
    public List<MovieLookupResultDto> search(
            @RequestParam("q") String query,
            @AuthenticationPrincipal OidcUser user) {
        String normalized = query.trim();
        if (normalized.length() < 2 || normalized.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Movie search must be 2 to 100 characters");
        }
        return service.search(normalized, accountService.getOrCreate(user));
    }
}
