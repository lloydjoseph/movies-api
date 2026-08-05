package com.example.movie.controller;

import com.example.movie.dto.MovieDto;
import com.example.movie.service.MovieService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/movies")
@RequiredArgsConstructor
@Validated
public class MovieController {

    private final MovieService service;

    @GetMapping("/all")
    public List<MovieDto> all() {
        return service.findAll();
    }

    @GetMapping("/search")
    public List<MovieDto> search(
            @RequestParam("s")
            @NotBlank
            @Size(min = 3, max = 100)
            String word) {
        return service.search(word);
    }

}
