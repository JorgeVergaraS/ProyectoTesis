package com.nexo.admin;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class AdminSecurity {
    @Bean
    JwtDecoder jwtDecoder(@Value("${nexo.azure.issuer}") String issuer,
            @Value("${nexo.azure.audience}") String audience,
            @Value("${nexo.azure.jwk-set-uri}") String jwks) {
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
        List<String> audiences = Arrays.stream(audience.split(",")).map(String::trim).toList();
        OAuth2TokenValidator<Jwt> expectedAudience = jwt -> jwt.getAudience().stream().anyMatch(audiences::contains)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid audience", null));
        String legacy = issuer.replace("https://login.microsoftonline.com/", "https://sts.windows.net/").replace("/v2.0", "/");
        OAuth2TokenValidator<Jwt> expectedIssuer = jwt -> jwt.getIssuer() != null
                && List.of(issuer, legacy).contains(jwt.getIssuer().toString())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid issuer", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), expectedIssuer, expectedAudience));
        return decoder;
    }
    @Bean
    SecurityFilterChain security(HttpSecurity http, @Value("${nexo.admin.object-ids:}") String allowed,
            @Value("${nexo.azure.required-scope:access_as_user}") String scope) throws Exception {
        var administrators = Arrays.stream(allowed.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
        http.csrf(csrf -> csrf.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**").permitAll()
                        .requestMatchers("/api/admin/rabbit/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .access((authentication, context) -> {
                            if (!(authentication.get() instanceof JwtAuthenticationToken token)) return new AuthorizationDecision(false);
                            Jwt jwt = token.getToken();
                            List<String> roles = jwt.getClaimAsStringList("roles");
                            boolean admin = roles != null && roles.contains("ADMIN")
                                    || administrators.contains(jwt.getClaimAsString("oid"));
                            String scopes = jwt.getClaimAsString("scp");
                            return new AuthorizationDecision(admin && scopes != null
                                    && Arrays.asList(scopes.split(" ")).contains(scope));
                        }).anyRequest().denyAll())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> {}));
        return http.build();
    }
}
