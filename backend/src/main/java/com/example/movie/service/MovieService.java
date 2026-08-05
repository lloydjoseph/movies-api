package com.example.movie.service;

import com.example.movie.dto.MovieDto;
import org.springframework.stereotype.Service;

import java.util.List;

public interface MovieService {

    List<MovieDto> findAll();

    List<MovieDto> search(String word);

}