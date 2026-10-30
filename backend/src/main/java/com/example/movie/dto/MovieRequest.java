package com.example.movie.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record MovieRequest(
        @NotBlank
        @Size(max = 255)
        String name,

        @NotNull
        @Positive
        Integer releaseYear,

        @Min(1)
        @Max(10)
        Integer rating
) {
}
