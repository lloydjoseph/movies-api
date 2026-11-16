package com.example.movie.repository;

import com.example.movie.entity.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WatchlistRepository extends JpaRepository<WatchlistItem, Long> {

    List<WatchlistItem> findAllByAccount_IdOrderByNameAsc(Long accountId);

    Optional<WatchlistItem> findByIdAndAccount_Id(Long id, Long accountId);

    boolean existsByAccount_IdAndNameIgnoreCase(Long accountId, String name);

    @Query("""
            select count(w) > 0 from WatchlistItem w
            where w.account.id = :accountId
              and w.id <> :excludeId
              and lower(trim(w.name)) = lower(:name)
            """)
    boolean existsDuplicateName(
            @Param("accountId") Long accountId,
            @Param("name") String name,
            @Param("excludeId") Long excludeId);

    @Query("""
            select count(w) > 0 from WatchlistItem w
            where w.account.id = :accountId
              and (:excludeId is null or w.id <> :excludeId)
              and lower(trim(w.name)) = lower(:name)
            """)
    boolean existsDuplicateNameExceptId(
            @Param("accountId") Long accountId,
            @Param("name") String name,
            @Param("excludeId") Long excludeId);
}
