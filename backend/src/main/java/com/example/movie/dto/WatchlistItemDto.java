package com.example.movie.dto;

import com.example.movie.entity.WatchlistPriority;

public record WatchlistItemDto(Long id, String name, Integer releaseYear, String notes, WatchlistPriority priority) {
}
