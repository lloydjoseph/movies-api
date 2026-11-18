package com.example.movie.service.impl;

import com.example.movie.config.TmdbProperties;
import com.example.movie.dto.MovieLookupResultDto;
import com.example.movie.entity.Account;
import com.example.movie.repository.MovieRepository;
import com.example.movie.service.MovieLookupService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class TmdbMovieLookupService implements MovieLookupService {

    private static final String LANGUAGE = "en-US";

    private final RestClient tmdbRestClient;
    private final TmdbProperties properties;
    private final MovieRepository movieRepository;

    @Override
    public List<MovieLookupResultDto> search(String query, Account account) {
        if (!properties.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Movie lookup is not configured");
        }

        TmdbSearchResponse response;
        try {
            response = tmdbRestClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/search/movie")
                            .queryParam("query", query)
                            .queryParam("include_adult", false)
                            .queryParam("language", LANGUAGE)
                            .queryParam("page", 1)
                            .build())
                    .retrieve()
                    .body(TmdbSearchResponse.class);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Movie lookup is temporarily unavailable", exception);
        }

        if (response == null || response.results() == null) return List.of();
        List<MovieLookupCandidate> results = response.results().stream()
                .filter(result -> result.id() != null && result.title() != null && !result.title().isBlank())
                .limit(8)
                .map(result -> new MovieLookupCandidate(
                        result.id(),
                        result.title(),
                        result.originalTitle() == null || result.originalTitle().isBlank()
                                ? result.title()
                                : result.originalTitle(),
                        releaseYear(result.releaseDate())))
                .toList();
        if (results.isEmpty()) return List.of();

        List<String> normalizedNames = results.stream()
                .map(result -> normalizeTitle(result.title()))
                .distinct()
                .toList();
        Set<MovieKey> existingMovies = Set.copyOf(movieRepository.findByAccountAndNormalizedNames(
                        account.getId(), normalizedNames).stream()
                .map(movie -> new MovieKey(normalizeTitle(movie.getName()), movie.getReleaseYear()))
                .toList());

        return results.stream()
                .map(result -> new MovieLookupResultDto(
                        result.tmdbId(),
                        result.title(),
                        result.originalTitle(),
                        result.releaseYear(),
                        result.releaseYear() != null
                                && existingMovies.contains(new MovieKey(
                                        normalizeTitle(result.title()), result.releaseYear()))))
                .toList();
    }

    private String normalizeTitle(String title) {
        return title.trim().toLowerCase(Locale.ROOT);
    }

    private Integer releaseYear(String releaseDate) {
        if (releaseDate == null || releaseDate.length() < 4) return null;
        try {
            int year = Integer.parseInt(releaseDate.substring(0, 4));
            return year > 0 ? year : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TmdbSearchResponse(List<TmdbSearchResult> results) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TmdbSearchResult(
            Long id,
            String title,
            @JsonProperty("original_title") String originalTitle,
            @JsonProperty("release_date") String releaseDate
    ) {
    }

    private record MovieLookupCandidate(long tmdbId, String title, String originalTitle, Integer releaseYear) {
    }

    private record MovieKey(String title, Integer releaseYear) {
    }
}
