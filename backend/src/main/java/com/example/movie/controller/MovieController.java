package com.example.movie.controller;

import com.example.movie.dto.MovieDto;
import com.example.movie.dto.MoviePageDto;
import com.example.movie.dto.MovieRequest;
import com.example.movie.entity.Account;
import com.example.movie.service.AccountService;
import com.example.movie.service.MovieService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
public class MovieController {

    private final MovieService service;
    private final AccountService accountService;

    @GetMapping
    public MoviePageDto catalog(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "all") String ratingMode,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false) Integer maxRating,
            @AuthenticationPrincipal OidcUser user) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or size");
        }

        String title = normalizeQuery(q);
        validateRatingFilter(ratingMode, rating, minRating, maxRating);
        Account account = accountService.getOrCreate(user);
        return service.findCatalogPage(account, title, ratingMode, rating, minRating, maxRating,
                PageRequest.of(page, size));
    }

    private String normalizeQuery(String query) {
        if (query == null) return null;
        String normalized = query.trim();
        if (normalized.length() < 3 || normalized.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title query must be 3 to 100 characters");
        }
        return normalized.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private void validateRatingFilter(String mode, Integer rating, Integer minRating, Integer maxRating) {
        boolean valid = switch (mode) {
            case "all", "unrated" -> rating == null && minRating == null && maxRating == null;
            case "exact" -> rating != null && rating >= 1 && rating <= 10 && minRating == null && maxRating == null;
            case "range" -> rating == null && minRating != null && maxRating != null
                    && minRating >= 1 && maxRating <= 10 && minRating <= maxRating;
            default -> false;
        };
        if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid rating filter");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MovieDto create(
            @Valid @RequestBody MovieRequest request,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        return service.create(request, account);
    }

    @PutMapping("/{id}")
    public MovieDto update(
            @PathVariable @Positive Integer id,
            @Valid @RequestBody MovieRequest request,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        return service.update(id, request, account);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable @Positive Integer id,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        service.delete(id, account);
    }

}
