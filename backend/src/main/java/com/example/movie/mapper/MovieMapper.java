package com.example.movie.mapper;

import com.example.movie.dto.MovieDto;
import com.example.movie.dto.MovieRequest;
import com.example.movie.entity.Movie;
import org.springframework.stereotype.Component;

@Component
public class MovieMapper {

    public MovieDto toDto(Movie movie) {

        return MovieDto.builder()
                .id(movie.getId())
                .name(movie.getName())
                .releaseYear(movie.getReleaseYear())
                .rating(movie.getRating())
                .build();
    }

    public Movie toEntity(MovieRequest request) {
        return Movie.builder()
                .name(request.name().trim())
                .releaseYear(request.releaseYear())
                .rating(request.rating())
                .build();
    }

    public void updateEntity(MovieRequest request, Movie movie) {
        movie.setName(request.name().trim());
        movie.setReleaseYear(request.releaseYear());
        movie.setRating(request.rating());
    }

}
