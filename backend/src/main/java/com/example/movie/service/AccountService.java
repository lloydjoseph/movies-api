package com.example.movie.service;

import com.example.movie.entity.Account;
import com.example.movie.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository repository;

    @Transactional
    public Account getOrCreate(OidcUser user) {
        return repository.findByGoogleSubject(user.getSubject())
                .map(account -> updateProfile(account, user))
                .orElseGet(() -> repository.save(Account.builder()
                        .googleSubject(user.getSubject())
                        .email(user.getEmail())
                        .displayName(user.getFullName())
                        .build()));
    }

    private Account updateProfile(Account account, OidcUser user) {
        if (!account.getEmail().equals(user.getEmail())) {
            account.setEmail(user.getEmail());
        }
        if (!java.util.Objects.equals(account.getDisplayName(), user.getFullName())) {
            account.setDisplayName(user.getFullName());
        }
        return account;
    }
}
