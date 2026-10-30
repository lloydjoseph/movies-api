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

import java.util.List;

@RestController
@RequestMapping("/api/movies")
@RequiredArgsConstructor
public class MovieController {

    private final MovieService service;
    private final AccountService accountService;

    @GetMapping
    public MoviePageDto catalog(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String ratingMode,
            @RequestParam(required = false) Integer rating,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false) Integer maxRating,
            @RequestParam(required = false) List<Integer> ratings,
            @RequestParam(required = false) Boolean includeUnrated,
            @RequestParam(defaultValue = "rating_desc") String sort,
            @AuthenticationPrincipal OidcUser user) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or size");
        }

        String title = normalizeQuery(q);
        validateFilters(ratingMode, rating, minRating, maxRating, ratings);
        validateSort(sort);
        Account account = accountService.getOrCreate(user);
        return service.findCatalogPage(account, title, ratingMode, rating, minRating, maxRating,
                ratings, includeUnrated, sort, PageRequest.of(page, size));
    }

    private String normalizeQuery(String query) {
        if (query == null) return null;
        String normalized = query.trim();
        if (normalized.length() < 3 || normalized.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title query must be 3 to 100 characters");
        }
        return normalized.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }

    private void validateFilters(String mode, Integer rating, Integer minRating, Integer maxRating, List<Integer> ratings) {
        if (ratings != null) {
            for (Integer r : ratings) {
                if (r == null || r < 1 || r > 10) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each rating must be between 1 and 10");
                }
            }
        }
        if (mode != null && !mode.isBlank()) {
            boolean valid = switch (mode) {
                case "all", "unrated" -> rating == null && minRating == null && maxRating == null;
                case "exact" -> rating != null && rating >= 1 && rating <= 10 && minRating == null && maxRating == null;
                case "range" -> rating == null && minRating != null && maxRating != null
                        && minRating >= 1 && maxRating <= 10 && minRating <= maxRating;
                default -> false;
            };
            if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid rating filter");
        }
    }

    private void validateSort(String sort) {
        if (sort == null) return;
        boolean valid = switch (sort) {
            case "rating_desc", "rating_asc", "year_desc", "year_asc", "title_asc", "title_desc" -> true;
            default -> false;
        };
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sort parameter");
        }
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
