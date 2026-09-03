package com.nexo.user.entity;

import com.nexo.user.dto.UserView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "nexo")
public class UserEntity {
    @Id private UUID id;
    @Column(name = "identity_provider", nullable = false) private String identityProvider;
    @Column(name = "entra_object_id") private String entraObjectId;
    @Column(nullable = false) private String username;
    @Column private String email;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false) private String color;
    @Column(nullable = false) private String bio;
    @Column(nullable = false) private String status;
    @Column(nullable = false) private String availability;
    @Column(name = "avatar_version") private UUID avatarVersion;
    @Column(name = "password_hash") private String passwordHash;
    @Column(name = "profile_customized_at") private Instant profileCustomizedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected UserEntity() {}

    public static UserEntity local(String email, String displayName, String passwordHash) {
        UserEntity user = new UserEntity();
        user.id = UUID.randomUUID();
        user.identityProvider = "LOCAL";
        user.email = email;
        user.username = email;
        user.displayName = displayName;
        user.passwordHash = passwordHash;
        user.color = "#8B5CF6";
        user.bio = "";
        user.status = "ACTIVE";
        user.availability = "AVAILABLE";
        user.createdAt = Instant.now(); user.updatedAt = user.createdAt;
        return user;
    }

    public static UserEntity entra(String oid, String email, String username, String displayName) {
        UserEntity user = new UserEntity();
        user.id = UUID.randomUUID();
        user.identityProvider = "ENTRA";
        user.entraObjectId = oid;
        user.email = email;
        user.username = username;
        user.displayName = displayName;
        user.color = "#8B5CF6";
        user.bio = "";
        user.status = "ACTIVE";
        user.availability = "AVAILABLE";
        user.createdAt = Instant.now(); user.updatedAt = user.createdAt;
        return user;
    }

    public UUID getId() { return id; }
    public boolean isActiveDemo() { return "DEMO".equals(identityProvider) && "ACTIVE".equals(status); }
    public boolean isActive() { return "ACTIVE".equals(status); }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public String getIdentityProvider() { return identityProvider; }
    public String getEntraObjectId() { return entraObjectId; }
    public void changeAvatar(UUID version) { avatarVersion = version; updatedAt = Instant.now(); }
    public static String avatarUrl(UUID id, UUID version) {
        return version == null ? null : "/api/avatars/" + id + "/" + version;
    }
    public UserView toView(boolean online) {
        return new UserView(id, username, displayName, color, bio, availability,
                online, avatarUrl(id, avatarVersion), email);
    }

    public UserView toPublicView(boolean online) {
        return new UserView(id, username, displayName, color, bio, availability,
                online, avatarUrl(id, avatarVersion), null);
    }

    public void updateEntraProfile(String email, String username, String displayName) {
        this.email = email;
        if (profileCustomizedAt == null) {
            this.username = username;
            this.displayName = displayName;
        }
        this.updatedAt = Instant.now();
    }

    public void updateProfile(
            String displayName, String username, String bio, String color, String availability) {
        if (displayName != null) this.displayName = displayName;
        if (username != null) this.username = username;
        if (bio != null) this.bio = bio;
        if (color != null) this.color = color;
        if (availability != null) this.availability = availability;
        this.profileCustomizedAt = Instant.now();
        this.updatedAt = profileCustomizedAt;
    }
}
