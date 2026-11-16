package com.example.movie.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.example.movie.entity.WatchlistPriority;

public record WatchlistItemRequest(
        @NotBlank
        @Size(max = 255)
        String name,

        @Size(max = 500)
        String notes,

        WatchlistPriority priority
) {
}
