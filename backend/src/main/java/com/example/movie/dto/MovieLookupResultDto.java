package com.example.movie.dto;

public record MovieLookupResultDto(
        long tmdbId,
        String title,
        String originalTitle,
        Integer releaseYear,
        boolean alreadyInCollection
) {
}
