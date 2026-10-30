package com.example.movie.repository;

import com.example.movie.entity.Movie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Integer> {

    @Query("""
            select m from Movie m
            where m.account.id = :accountId
              and (:title is null or lower(m.name) like lower(concat(concat('%', :title), '%')) escape '!')
              and (
                    :ratingMode = 'all'
                    or (:ratingMode = 'unrated' and m.rating is null)
                    or (:ratingMode = 'exact' and m.rating = :exactRating)
                    or (:ratingMode = 'range' and m.rating between :minRating and :maxRating)
              )
            """)
    Page<Movie> findCatalogPage(
            @Param("accountId") Long accountId,
            @Param("title") String title,
            @Param("ratingMode") String ratingMode,
            @Param("exactRating") Integer exactRating,
            @Param("minRating") Integer minRating,
            @Param("maxRating") Integer maxRating,
            Pageable pageable);

    Optional<Movie> findByIdAndAccount_Id(Integer id, Long accountId);

}
