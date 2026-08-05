package com.example.movie.service.impl;

import com.example.movie.dto.MovieDto;
import com.example.movie.mapper.MovieMapper;
import com.example.movie.repository.MovieRepository;
import com.example.movie.service.MovieService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class MovieServiceImpl implements MovieService {

    private final MovieRepository repository;
    private final MovieMapper mapper;

    @Override
    public List<MovieDto> findAll() {

        return repository.findAll()
                .stream()
                .map(mapper::toDto)
                .toList();
    }

    @Override
    public List<MovieDto> search(String word) {

        return repository.findByNameContainingIgnoreCase(word)
                .stream()
                .map(mapper::toDto)
                .toList();
    }

}