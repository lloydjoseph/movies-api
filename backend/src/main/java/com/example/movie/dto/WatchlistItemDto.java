package com.example.movie.dto;

import com.example.movie.entity.WatchlistPriority;

public record WatchlistItemDto(Long id, String name, String notes, WatchlistPriority priority) {
}
