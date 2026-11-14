package com.studyhub.user.repository;

import com.studyhub.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    @Query("""
            SELECT u FROM User u
            WHERE (:query IS NULL OR :query = '' OR
                   LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR
                   LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(CONCAT('%', :query, '%')))
              AND (:university IS NULL OR :university = '' OR
                   LOWER(u.university) LIKE LOWER(CONCAT('%', :university, '%')))
              AND (:faculty IS NULL OR :faculty = '' OR
                   LOWER(u.faculty) LIKE LOWER(CONCAT('%', :faculty, '%')))
            ORDER BY u.firstName ASC, u.lastName ASC
            """)
    List<User> searchUsers(
            @Param("query") String query,
            @Param("university") String university,
            @Param("faculty") String faculty
    );
}