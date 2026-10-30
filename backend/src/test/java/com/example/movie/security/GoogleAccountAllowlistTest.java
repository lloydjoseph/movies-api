package com.example.movie.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleAccountAllowlistTest {

    @Test
    void allowsMultipleEmailsWithoutCaseOrWhitespaceSensitivity() {
        var allowlist = new GoogleAccountAllowlist(" owner@example.com , second@example.com ");

        assertThat(allowlist.allows("OWNER@example.com")).isTrue();
        assertThat(allowlist.allows(" second@example.com ")).isTrue();
        assertThat(allowlist.allows("other@example.com")).isFalse();
        assertThat(allowlist.allows(null)).isFalse();
    }

    @Test
    void emptyAllowlistDeniesEveryAccount() {
        var allowlist = new GoogleAccountAllowlist(" , ");

        assertThat(allowlist.allows("owner@example.com")).isFalse();
    }
}
