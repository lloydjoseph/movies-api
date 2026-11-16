package com.example.movie.service.impl;

import com.example.movie.dto.WatchlistItemDto;
import com.example.movie.dto.WatchlistItemRequest;
import com.example.movie.entity.Account;
import com.example.movie.entity.WatchlistItem;
import com.example.movie.entity.WatchlistPriority;
import com.example.movie.repository.MovieRepository;
import com.example.movie.repository.WatchlistRepository;
import com.example.movie.service.WatchlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class WatchlistServiceImpl implements WatchlistService {

    private final WatchlistRepository repository;
    private final MovieRepository movieRepository;

    @Override
    @Transactional(readOnly = true)
    public List<WatchlistItemDto> findAll(Account account) {
        return repository.findAllByAccount_IdOrderByNameAsc(account.getId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public WatchlistItemDto add(WatchlistItemRequest request, Account account) {
        String name = request.name().trim();
        if (repository.existsByAccount_IdAndNameIgnoreCase(account.getId(), name)
                || movieRepository.existsByAccountAndNormalizedNameExcludingId(account.getId(), name, null)) {
            throw duplicateTitle();
        }

        WatchlistItem item = repository.save(WatchlistItem.builder()
                .name(name)
                .notes(normalizeNotes(request.notes()))
                .priority(request.priority() == null ? WatchlistPriority.MEDIUM : request.priority())
                .account(account)
                .build());
        return toDto(item);
    }

    @Override
    public WatchlistItemDto update(Long id, WatchlistItemRequest request, Account account) {
        WatchlistItem item = repository.findByIdAndAccount_Id(id, account.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watchlist item not found"));
        String name = request.name().trim();
        if (repository.existsDuplicateName(account.getId(), name, id)
                || movieRepository.existsByAccountAndNormalizedNameExcludingId(account.getId(), name, null)) {
            throw duplicateTitle();
        }
        item.setName(name);
        item.setNotes(normalizeNotes(request.notes()));
        if (request.priority() != null) item.setPriority(request.priority());
        return toDto(repository.save(item));
    }

    @Override
    public void delete(Long id, Account account) {
        WatchlistItem item = repository.findByIdAndAccount_Id(id, account.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watchlist item not found"));
        repository.delete(item);
    }

    private ResponseStatusException duplicateTitle() {
        return new ResponseStatusException(
                HttpStatus.CONFLICT, "Movie is already in your collection or watchlist");
    }

    private String normalizeNotes(String notes) {
        if (notes == null || notes.isBlank()) return null;
        return notes.trim();
    }

    private WatchlistItemDto toDto(WatchlistItem item) {
        return new WatchlistItemDto(item.getId(), item.getName(), item.getNotes(), item.getPriority());
    }
}
