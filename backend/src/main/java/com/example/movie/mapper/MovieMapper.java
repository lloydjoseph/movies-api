package com.example.movie.mapper;

import com.example.movie.dto.MovieDto;
import com.example.movie.entity.Movie;
import org.springframework.stereotype.Component;

@Component
public class MovieMapper {

    public MovieDto toDto(Movie movie) {

        return MovieDto.builder()
                .id(movie.getId())
                .name(movie.getName())
                .rating(movie.getRating())
                .build();
    }

}