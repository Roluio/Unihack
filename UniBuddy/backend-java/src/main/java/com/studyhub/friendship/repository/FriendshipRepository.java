package com.studyhub.friendship.repository;

import com.studyhub.friendship.entity.Friendship;
import com.studyhub.friendship.entity.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    @Query("""
            SELECT f FROM Friendship f
            WHERE ((f.sender.id = :userA AND f.receiver.id = :userB)
                OR (f.sender.id = :userB AND f.receiver.id = :userA))
              AND f.status IN :statuses
            """)
    Optional<Friendship> findBetweenUsersWithStatuses(
            @Param("userA") UUID userA,
            @Param("userB") UUID userB,
            @Param("statuses") List<FriendshipStatus> statuses
    );

    @Query("""
            SELECT f FROM Friendship f
            JOIN FETCH f.sender
            WHERE f.receiver.id = :receiverId
              AND f.status = :status
            ORDER BY f.createdAt DESC
            """)
    List<Friendship> findReceivedRequests(
            @Param("receiverId") UUID receiverId,
            @Param("status") FriendshipStatus status
    );

    @Query("""
            SELECT f FROM Friendship f
            JOIN FETCH f.receiver
            WHERE f.sender.id = :senderId
              AND f.status = :status
            ORDER BY f.createdAt DESC
            """)
    List<Friendship> findSentRequests(
            @Param("senderId") UUID senderId,
            @Param("status") FriendshipStatus status
    );

    @Query("""
            SELECT f FROM Friendship f
            JOIN FETCH f.sender
            JOIN FETCH f.receiver
            WHERE (f.sender.id = :userId OR f.receiver.id = :userId)
              AND f.status = 'ACCEPTED'
            ORDER BY f.updatedAt DESC
            """)
    List<Friendship> findAcceptedFriendshipsForUser(@Param("userId") UUID userId);
}