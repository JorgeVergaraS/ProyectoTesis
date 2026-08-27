package com.nexo.user.controller;

import com.nexo.auth.demo.DemoPrincipal;
import com.nexo.user.dto.UserView;
import com.nexo.user.service.AvatarService;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Profile("local-demo")
@RequestMapping("/api/demo")
public class AvatarController {
    private final AvatarService avatars;
    public AvatarController(AvatarService avatars) { this.avatars = avatars; }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    public UserView upload(@AuthenticationPrincipal DemoPrincipal me, @RequestParam MultipartFile file) {
        return avatars.upload(me.userId(), file);
    }

    @DeleteMapping("/me/avatar")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    public UserView remove(@AuthenticationPrincipal DemoPrincipal me) { return avatars.remove(me.userId()); }

    @GetMapping(value = "/avatars/{userId}/{version}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> read(@PathVariable UUID userId, @PathVariable UUID version) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.IMAGE_PNG).body(avatars.read(userId, version));
    }
}
