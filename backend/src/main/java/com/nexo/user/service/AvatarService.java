package com.nexo.user.service;

import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AvatarService {
    private final UserRepository users;
    private final JdbcClient jdbc;
    public AvatarService(UserRepository users, JdbcClient jdbc) { this.users = users; this.jdbc = jdbc; }

    @Transactional
    public UserView upload(UUID userId, MultipartFile file) {
        byte[] image = normalize(file);
        var user = require(userId);
        jdbc.sql("""
                INSERT INTO nexo.user_avatars(user_id,image) VALUES (:user,:image)
                ON CONFLICT (user_id) DO UPDATE SET image=EXCLUDED.image
                """).param("user", userId).param("image", image).update();
        user.changeAvatar(UUID.randomUUID());
        return user.toView(true);
    }

    @Transactional
    public UserView remove(UUID userId) {
        var user = require(userId);
        jdbc.sql("DELETE FROM nexo.user_avatars WHERE user_id=:id").param("id", userId).update();
        user.changeAvatar(null);
        return user.toView(true);
    }

    public byte[] read(UUID userId, UUID version) {
        return jdbc.sql("""
                SELECT a.image FROM nexo.user_avatars a JOIN nexo.users u ON u.id=a.user_id
                WHERE u.id=:id AND u.avatar_version=:version AND u.status='ACTIVE'
                """).param("id", userId).param("version", version)
                .query((rs, row) -> rs.getBytes("image")).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private byte[] normalize(MultipartFile file) {
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (file.getSize() > 2 * 1024 * 1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        try (var source = file.getInputStream(); var input = ImageIO.createImageInputStream(source)) {
            if (input == null) throw invalid();
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!format.equals("png") && !format.equals("jpeg")) throw invalid();
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 4096 || height > 4096 || (long) width * height > 16_000_000)
                    throw invalid();
                BufferedImage decoded = reader.read(0);
                int side = Math.min(width, height), size = Math.min(512, side);
                var output = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
                var graphics = output.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                    int x = (width - side) / 2, y = (height - side) / 2;
                    graphics.drawImage(decoded, 0, 0, size, size, x, y, x + side, y + side, null);
                } finally { graphics.dispose(); }
                var bytes = new ByteArrayOutputStream();
                if (!ImageIO.write(output, "png", bytes)) throw invalid();
                return bytes.toByteArray();
            } finally { reader.dispose(); }
        } catch (IOException | IllegalArgumentException exception) { throw invalid(); }
    }

    private UserEntity require(UUID userId) {
        return users.findById(userId).filter(UserEntity::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE); }
}
