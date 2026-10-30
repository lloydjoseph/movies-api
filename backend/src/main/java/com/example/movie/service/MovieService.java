package com.example.movie.service;

import com.example.movie.dto.MovieDto;
import com.example.movie.dto.MoviePageDto;
import com.example.movie.dto.MovieRequest;
import com.example.movie.entity.Account;
import org.springframework.data.domain.Pageable;
public interface MovieService {

    MoviePageDto findCatalogPage(
            Account account,
            String title,
            String ratingMode,
            Integer exactRating,
            Integer minRating,
            Integer maxRating,
            Pageable pageable);

    MovieDto create(MovieRequest request, Account account);

    MovieDto update(Integer id, MovieRequest request, Account account);

    void delete(Integer id, Account account);

}
