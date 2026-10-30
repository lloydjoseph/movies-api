package com.example.movie.dto;

import java.util.List;

public record MoviePageDto(
        List<MovieDto> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
}
