package com.example.movie.service.impl;

import com.example.movie.dto.MovieDto;
import com.example.movie.dto.MoviePageDto;
import com.example.movie.dto.MovieRequest;
import com.example.movie.entity.Account;
import com.example.movie.entity.Movie;
import com.example.movie.mapper.MovieMapper;
import com.example.movie.repository.MovieRepository;
import com.example.movie.service.MovieService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class MovieServiceImpl implements MovieService {

    private final MovieRepository repository;
    private final MovieMapper mapper;

    @Override
    public MoviePageDto findCatalogPage(
            Account account,
            String title,
            String ratingMode,
            Integer exactRating,
            Integer minRating,
            Integer maxRating,
            List<Integer> ratings,
            Boolean includeUnrated,
            String sort,
            Pageable pageable) {
        String filterMode = "none";
        List<Integer> effectiveRatings = List.of(-1);

        if (ratings != null && !ratings.isEmpty()) {
            effectiveRatings = ratings;
            filterMode = Boolean.TRUE.equals(includeUnrated) ? "ratings_or_unrated" : "ratings";
        } else if (Boolean.TRUE.equals(includeUnrated)) {
            filterMode = "unrated";
        } else if ("unrated".equalsIgnoreCase(ratingMode)) {
            filterMode = "unrated";
        } else if ("exact".equalsIgnoreCase(ratingMode) && exactRating != null) {
            filterMode = "exact";
        } else if ("range".equalsIgnoreCase(ratingMode) && minRating != null && maxRating != null) {
            filterMode = "range";
        }

        Pageable orderedPage = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), resolveSort(sort));
        Page<MovieDto> result = repository.findCatalogPage(
                        account.getId(), title == null ? "" : title, filterMode,
                        effectiveRatings, exactRating, minRating, maxRating, orderedPage)
                .map(mapper::toDto);
        return new MoviePageDto(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), result.hasNext());
    }

    private Sort resolveSort(String sort) {
        String normalizedSort = sort == null ? "rating_desc" : sort;
        return switch (normalizedSort) {
            case "rating_desc" -> Sort.by(
                    Sort.Order.desc("rating").nullsLast(),
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("name"),
                    Sort.Order.asc("id")
            );
            case "rating_asc" -> Sort.by(
                    Sort.Order.asc("rating").nullsLast(),
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("name"),
                    Sort.Order.asc("id")
            );
            case "year_desc" -> Sort.by(
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("name"),
                    Sort.Order.asc("id")
            );
            case "year_asc" -> Sort.by(
                    Sort.Order.asc("releaseYear"),
                    Sort.Order.asc("name"),
                    Sort.Order.asc("id")
            );
            case "title_asc" -> Sort.by(
                    Sort.Order.asc("name"),
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("id")
            );
            case "title_desc" -> Sort.by(
                    Sort.Order.desc("name"),
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("id")
            );
            default -> Sort.by(
                    Sort.Order.desc("rating").nullsLast(),
                    Sort.Order.desc("releaseYear"),
                    Sort.Order.asc("name"),
                    Sort.Order.asc("id")
            );
        };
    }

    @Override
    public MovieDto create(MovieRequest request, Account account) {
        var movie = mapper.toEntity(request);
        movie.setAccount(account);
        return mapper.toDto(repository.save(movie));
    }

    @Override
    public MovieDto update(Integer id, MovieRequest request, Account account) {
        var movie = findOwnedMovie(id, account);
        mapper.updateEntity(request, movie);
        return mapper.toDto(repository.save(movie));
    }

    @Override
    public void delete(Integer id, Account account) {
        repository.delete(findOwnedMovie(id, account));
    }

    private Movie findOwnedMovie(Integer id, Account account) {
        return repository.findByIdAndAccount_Id(id, account.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Movie not found"));
    }

}
