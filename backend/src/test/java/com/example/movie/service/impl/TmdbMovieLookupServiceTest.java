package com.example.movie.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.example.movie.config.TmdbProperties;
import com.example.movie.dto.MovieLookupResultDto;
import com.example.movie.entity.Account;
import com.example.movie.entity.Movie;
import com.example.movie.repository.MovieRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

class TmdbMovieLookupServiceTest {

    private MockRestServiceServer server;
    private TmdbMovieLookupService service;
    private MovieRepository movieRepository;
    private final Account account = Account.builder().id(1L).build();

    @BeforeEach
    void setUp() {
        movieRepository = mock(MovieRepository.class);
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("https://api.themoviedb.org/3");
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient client = builder
                .defaultHeader(AUTHORIZATION, "Bearer test-access-token")
                .build();
        service = new TmdbMovieLookupService(client, new TmdbProperties("test-access-token"), movieRepository);
    }

    @Test
    void mapsMovieSearchResultsAndUsesServerSideBearerAuthentication() {
        server.expect(requestTo("https://api.themoviedb.org/3/search/movie"
                        + "?query=Arrival&include_adult=false&language=en-US&page=1"))
                .andExpect(header(AUTHORIZATION, "Bearer test-access-token"))
                .andRespond(withSuccess("""
                        {
                          "page": 1,
                          "results": [
                            {
                              "id": 329865,
                              "title": "The Mist",
                              "original_title": "The Mist",
                              "release_date": "2007-06-21",
                              "overview": "Ignored provider fields are not returned."
                            },
                            {
                              "id": 42,
                              "title": "The Mist",
                              "original_title": "The Mist",
                              "release_date": "2016-01-01"
                            },
                            {
                              "id": 43,
                              "title": "The Mist",
                              "original_title": "The Mist",
                              "release_date": ""
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));
        when(movieRepository.findByAccountAndNormalizedNames(1L, List.of("the mist")))
                .thenReturn(List.of(Movie.builder().name("  tHe MiSt ").releaseYear(2007).build()));

        List<MovieLookupResultDto> results = service.search("Arrival", account);

        assertThat(results).containsExactly(
                new MovieLookupResultDto(329865, "The Mist", "The Mist", 2007, true),
                new MovieLookupResultDto(42, "The Mist", "The Mist", 2016, false),
                new MovieLookupResultDto(43, "The Mist", "The Mist", null, false));
        server.verify();
    }

    @Test
    void mapsProviderAuthenticationFailuresToServiceUnavailable() {
        server.expect(requestTo("https://api.themoviedb.org/3/search/movie"
                        + "?query=Arrival&include_adult=false&language=en-US&page=1"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> service.search("Arrival", account))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(SERVICE_UNAVAILABLE));
        server.verify();
    }

    @Test
    void doesNotCallProviderWhenNoAccessTokenIsConfigured() {
        service = new TmdbMovieLookupService(
                RestClient.builder().baseUrl("https://api.themoviedb.org/3").build(),
                new TmdbProperties(""),
                movieRepository);

        assertThatThrownBy(() -> service.search("Arrival", account))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(SERVICE_UNAVAILABLE));
        server.verify();
    }
}
