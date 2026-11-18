package com.example.movie.service;

import com.example.movie.dto.MovieLookupResultDto;
import com.example.movie.entity.Account;
import java.util.List;

public interface MovieLookupService {

    List<MovieLookupResultDto> search(String query, Account account);
}
