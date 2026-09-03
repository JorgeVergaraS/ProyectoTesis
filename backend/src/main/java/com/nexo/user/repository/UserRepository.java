package com.nexo.user.repository;

import com.nexo.user.entity.UserEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    List<UserEntity> findByIdentityProviderAndStatusOrderByDisplayName(String identityProvider, String status);
    List<UserEntity> findByStatusOrderByDisplayName(String status);
    java.util.Optional<UserEntity> findByEmailIgnoreCase(String email);
    java.util.Optional<UserEntity> findByEntraObjectId(String entraObjectId);
    java.util.Optional<UserEntity> findByUsernameIgnoreCase(String username);
}
