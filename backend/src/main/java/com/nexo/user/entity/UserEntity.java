package com.nexo.user.entity;

import com.nexo.user.dto.UserView;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "nexo")
public class UserEntity {
    @Id private UUID id;
    @Column(name = "identity_provider", nullable = false) private String identityProvider;
    @Column(nullable = false) private String username;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false) private String color;
    @Column(nullable = false) private String bio;
    @Column(nullable = false) private String status;
    @Column(name = "avatar_version") private UUID avatarVersion;

    protected UserEntity() {}

    public UUID getId() { return id; }
    public boolean isActiveDemo() { return "DEMO".equals(identityProvider) && "ACTIVE".equals(status); }
    public void changeAvatar(UUID version) { avatarVersion = version; }
    public static String avatarUrl(UUID id, UUID version) {
        return version == null ? null : "/api/demo/avatars/" + id + "/" + version;
    }
    public UserView toView(boolean online) {
        return new UserView(id, username, displayName, color, bio, online, avatarUrl(id, avatarVersion));
    }
}
