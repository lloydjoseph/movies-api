package com.example.movie.controller;

import com.example.movie.dto.WatchlistItemDto;
import com.example.movie.dto.WatchlistItemRequest;
import com.example.movie.entity.Account;
import com.example.movie.service.AccountService;
import com.example.movie.service.WatchlistService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.List;

@RestController
@RequestMapping("/api/watchlist")
@RequiredArgsConstructor
public class WatchlistController {

    private final WatchlistService service;
    private final AccountService accountService;

    @GetMapping
    public List<WatchlistItemDto> list(@AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        return service.findAll(account);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WatchlistItemDto add(
            @Valid @RequestBody WatchlistItemRequest request,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        return service.add(request, account);
    }

    @PutMapping("/{id}")
    public WatchlistItemDto update(
            @PathVariable @Positive Long id,
            @Valid @RequestBody WatchlistItemRequest request,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        return service.update(id, request, account);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable @Positive Long id,
            @AuthenticationPrincipal OidcUser user) {
        Account account = accountService.getOrCreate(user);
        service.delete(id, account);
    }
}
