package com.example.movie.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import com.example.movie.entity.WatchlistPriority;

public record WatchlistItemRequest(
        @NotBlank
        @Size(max = 255)
        String name,

        @Min(1)
        @Max(9999)
        Integer releaseYear,

        @Size(max = 500)
        String notes,

        WatchlistPriority priority
) {
}
