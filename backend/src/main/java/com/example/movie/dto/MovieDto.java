package com.example.movie.dto;

import lombok.Builder;

@Builder
public record MovieDto(
        Integer id,
        String name,
        Integer releaseYear,
        Integer rating
) {}
