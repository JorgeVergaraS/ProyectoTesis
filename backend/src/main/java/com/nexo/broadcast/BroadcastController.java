package com.nexo.broadcast;

import com.nexo.user.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api", "/api/demo"})
public class BroadcastController {
    public record Create(@NotBlank @Size(max=120) String title,
            @NotNull @Pattern(regexp="CAMERA|SCREEN") String sourceType) {}
    private final BroadcastService service;
    private final CurrentUserService users;
    public BroadcastController(BroadcastService service, CurrentUserService users) {
        this.service = service; this.users = users;
    }
    @GetMapping("/broadcasts/config")
    public Map<String, Boolean> config(Authentication auth) {
        users.require(auth); return Map.of("enabled", service.enabled());
    }
    @PostMapping("/conversations/{id}/broadcasts")
    public BroadcastRepository.Broadcast create(Authentication auth, @PathVariable UUID id, @Valid @RequestBody Create body) {
        return service.create(id, users.require(auth).userId(), body.title(), body.sourceType());
    }
    @GetMapping("/conversations/{id}/broadcasts/active")
    public List<BroadcastRepository.Broadcast> active(Authentication auth, @PathVariable UUID id) {
        return service.active(id, users.require(auth).userId());
    }
    @PostMapping("/broadcasts/{id}/access")
    public ResponseEntity<BroadcastService.Access> access(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.access(id, users.require(auth).userId()));
    }
    @PostMapping("/broadcasts/{id}/start")
    public BroadcastRepository.Broadcast start(Authentication auth, @PathVariable UUID id) {
        return service.start(id, users.require(auth).userId());
    }
    @PostMapping("/broadcasts/{id}/end")
    public BroadcastRepository.Broadcast end(Authentication auth, @PathVariable UUID id) {
        return service.end(id, users.require(auth).userId());
    }
}
