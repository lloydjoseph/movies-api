package com.example.movie;

import com.example.movie.repository.AccountRepository;
import com.example.movie.repository.MovieRepository;
import com.example.movie.entity.Account;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.nullValue;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MovieApiIntegrationTests {

    @Container
    private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17")
            .withDatabaseName("movie_test")
            .withUsername("test")
            .withPassword("test");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("google.oauth.enabled", () -> false);
        registry.add("app.security.allowed-google-emails", () -> "owner@example.com,second@example.com");
        registry.add("app.security.session-cookie-secure", () -> false);
    }

    @BeforeEach
    void clearDatabase() {
        movieRepository.deleteAllInBatch();
        accountRepository.deleteAllInBatch();
    }

    @Test
    void createsUpdatesSearchesAndDeletesOwnedMovie() throws Exception {
        String createdJson = mockMvc.perform(post("/api/movies")
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(movieJson("CRUD integration test", 2020, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("CRUD integration test"))
                .andExpect(jsonPath("$.releaseYear").value(2020))
                .andExpect(jsonPath("$.rating").value(nullValue()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        int id = ((Number) JsonPath.read(createdJson, "$.id")).intValue();

        mockMvc.perform(get("/api/movies").with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id));

        mockMvc.perform(put("/api/movies/{id}", id)
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(movieJson("Updated CRUD test", 2021, 8)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated CRUD test"))
                .andExpect(jsonPath("$.releaseYear").value(2021))
                .andExpect(jsonPath("$.rating").value(8));

        mockMvc.perform(get("/api/movies")
                        .param("q", "updated")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id));

        mockMvc.perform(delete("/api/movies/{id}", id)
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/movies").with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void readsUpdatesAndDeletesAreIsolatedByAccount() throws Exception {
        int id = createMovie("owner-sub", "owner@example.com", "Private movie", 1999, 6);

        mockMvc.perform(get("/api/movies").with(oidcUser("other-sub", "second@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());

        mockMvc.perform(get("/api/movies")
                        .param("q", "Private")
                        .with(oidcUser("other-sub", "second@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());

        mockMvc.perform(put("/api/movies/{id}", id)
                        .with(oidcUser("other-sub", "second@example.com"))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(movieJson("Attempted takeover", 2000, 10)))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/movies/{id}", id)
                        .with(oidcUser("other-sub", "second@example.com"))
                        .with(csrf()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/movies").with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id))
                .andExpect(jsonPath("$.items[0].name").value("Private movie"));
    }

    @Test
    void assignsOwnerFromSessionAndIgnoresClientOwnershipFields() throws Exception {
        String createdJson = mockMvc.perform(post("/api/movies")
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"name\":\"Owner assignment\",\"releaseYear\":2022,"
                                + "\"rating\":null,\"accountId\":9999}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        int id = ((Number) JsonPath.read(createdJson, "$.id")).intValue();
        var owner = accountRepository.findByGoogleSubject("owner-sub").orElseThrow();
        var other = accountRepository.save(Account.builder()
                .googleSubject("other-sub")
                .email("second@example.com")
                .displayName("Second account")
                .build());

        assertThat(movieRepository.findByIdAndAccount_Id(id, owner.getId())).isPresent();
        assertThat(movieRepository.findByIdAndAccount_Id(id, other.getId())).isEmpty();
    }

    @Test
    void rejectsInvalidMovieFields() throws Exception {
        assertInvalidMovie("{\"name\":\" \",\"releaseYear\":2020,\"rating\":5}");
        assertInvalidMovie("{\"name\":\"No year\",\"rating\":5}");
        assertInvalidMovie(movieJson("Invalid year", 0, 5));
        assertInvalidMovie(movieJson("Invalid rating", 2020, 11));
        assertInvalidMovie(movieJson("Invalid rating", 2020, 0));
        assertInvalidMovie(movieJson("x".repeat(256), 2020, null));
    }

    @Test
    void rejectsInvalidSearchTerms() throws Exception {
        for (String term : new String[]{"", "ab", "x".repeat(101)}) {
            mockMvc.perform(get("/api/movies")
                            .param("q", term)
                            .with(oidcUser("owner-sub", "owner@example.com")))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void pagesAndFiltersOnlyTheSignedInUsersCatalogInStableOrder() throws Exception {
        createMovie("owner-sub", "owner@example.com", "Older rated", 2019, 5);
        createMovie("owner-sub", "owner@example.com", "Latest rated", 2022, 8);
        createMovie("owner-sub", "owner@example.com", "Newest unrated", 2023, null);
        createMovie("other-sub", "second@example.com", "Other account", 2024, 9);

        // Default sort is rating descending with unrated last (8, 5, null)
        mockMvc.perform(get("/api/movies")
                        .param("page", "0")
                        .param("size", "2")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Latest rated"))
                .andExpect(jsonPath("$.items[1].name").value("Older rated"))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.hasNext").value(true));

        // Year descending sort
        mockMvc.perform(get("/api/movies")
                        .param("sort", "year_desc")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Newest unrated"));

        // Title ascending sort
        mockMvc.perform(get("/api/movies")
                        .param("sort", "title_asc")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Latest rated"));

        mockMvc.perform(get("/api/movies")
                        .param("q", "latest")
                        .param("ratingMode", "range")
                        .param("minRating", "7")
                        .param("maxRating", "8")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Latest rated"))
                .andExpect(jsonPath("$.totalItems").value(1));

        // Multi-select ratings filter (8 and 5)
        mockMvc.perform(get("/api/movies")
                        .param("ratings", "8,5")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.totalItems").value(2));

        // Multi-select ratings with includeUnrated
        mockMvc.perform(get("/api/movies")
                        .param("ratings", "8")
                        .param("includeUnrated", "true")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Latest rated"))
                .andExpect(jsonPath("$.items[1].name").value("Newest unrated"));
    }

    @Test
    void rejectsOutOfRangePagingAndRatingFilters() throws Exception {
        mockMvc.perform(get("/api/movies")
                        .param("size", "101")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/movies")
                        .param("ratingMode", "range")
                        .param("minRating", "8")
                        .param("maxRating", "4")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/movies")
                        .param("ratings", "0,8")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/movies")
                        .param("sort", "unknown")
                        .with(oidcUser("owner-sub", "owner@example.com")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requiresAuthenticationAndCsrfForWrites() throws Exception {
        mockMvc.perform(get("/api/movies"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/movies")
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(movieJson("Unauthenticated", 2020, null)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/movies")
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .contentType(APPLICATION_JSON)
                        .content(movieJson("Missing CSRF", 2020, null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void liquibaseCreatesTheExpectedSchemaConstraints() {
        assertThat(columnNullability("name")).isEqualTo("NO");
        assertThat(columnNullability("release_year")).isEqualTo("NO");
        assertThat(columnNullability("account_id")).isEqualTo("NO");
        assertThat(columnNullability("rating")).isEqualTo("YES");

        Integer ratingConstraintCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.movie'::regclass "
                        + "AND conname='ck_movie_rating_range'",
                Integer.class);
        assertThat(ratingConstraintCount).isEqualTo(1);

        Integer releaseYearConstraintCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.movie'::regclass "
                        + "AND conname='ck_movie_release_year_positive'",
                Integer.class);
        assertThat(releaseYearConstraintCount).isEqualTo(1);

        String identity = jdbcTemplate.queryForObject(
                "SELECT is_identity FROM information_schema.columns "
                        + "WHERE table_schema='public' AND table_name='movie' AND column_name='id'",
                String.class);
        String defaultValue = jdbcTemplate.queryForObject(
                "SELECT column_default FROM information_schema.columns "
                        + "WHERE table_schema='public' AND table_name='movie' AND column_name='id'",
                String.class);
        assertThat("YES".equals(identity) || (defaultValue != null && defaultValue.contains("nextval"))).isTrue();
    }

    private int createMovie(String subject, String email, String name, int releaseYear, Integer rating)
            throws Exception {
        String json = mockMvc.perform(post("/api/movies")
                        .with(oidcUser(subject, email))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(movieJson(name, releaseYear, rating)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).intValue();
    }

    private void assertInvalidMovie(String json) throws Exception {
        mockMvc.perform(post("/api/movies")
                        .with(oidcUser("owner-sub", "owner@example.com"))
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest());
    }

    private String columnNullability(String columnName) {
        return jdbcTemplate.queryForObject(
                "SELECT is_nullable FROM information_schema.columns "
                        + "WHERE table_schema='public' AND table_name='movie' AND column_name=?",
                String.class,
                columnName);
    }

    private static RequestPostProcessor oidcUser(String subject, String email) {
        return oidcLogin().idToken(token -> token
                .subject(subject)
                .claim("email", email)
                .claim("email_verified", true)
                .claim("name", email));
    }

    private static String movieJson(String name, int releaseYear, Integer rating) {
        String ratingJson = rating == null ? "null" : rating.toString();
        return "{\"name\":\"" + name + "\",\"releaseYear\":" + releaseYear + ",\"rating\":" + ratingJson + "}";
    }
}
