package com.example.movie.service;

import com.example.movie.dto.WatchlistItemDto;
import com.example.movie.dto.WatchlistItemRequest;
import com.example.movie.entity.Account;

import java.util.List;

public interface WatchlistService {

    List<WatchlistItemDto> findAll(Account account);

    WatchlistItemDto add(WatchlistItemRequest request, Account account);

    WatchlistItemDto update(Long id, WatchlistItemRequest request, Account account);

    void delete(Long id, Account account);
}
