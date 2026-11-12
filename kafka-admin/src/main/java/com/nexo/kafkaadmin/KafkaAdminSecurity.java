package com.nexo.kafkaadmin;

import java.util.Arrays;
import java.util.List;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class KafkaAdminSecurity {
    @Bean
    JwtDecoder jwtDecoder(@Value("${nexo.azure.issuer}") String issuer,
            @Value("${nexo.azure.audience}") String audience,
            @Value("${nexo.azure.jwk-set-uri}") String jwks) {
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
        List<String> audiences = Arrays.stream(audience.split(",")).map(String::trim).toList();
        OAuth2TokenValidator<Jwt> expectedAudience = jwt -> jwt.getAudience().stream().anyMatch(audiences::contains)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid audience", null));
        String legacyIssuer = issuer.replace("https://login.microsoftonline.com/", "https://sts.windows.net/")
                .replace("/v2.0", "/");
        OAuth2TokenValidator<Jwt> expectedIssuer = jwt -> jwt.getIssuer() != null
                && List.of(issuer, legacyIssuer).contains(jwt.getIssuer().toString())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid issuer", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(), expectedIssuer, expectedAudience));
        return decoder;
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http,
            @Value("${nexo.admin.object-ids:}") String allowedObjectIds,
            @Value("${nexo.azure.required-scope:access_as_user}") String requiredScope) throws Exception {
        List<String> administrators = Arrays.stream(allowedObjectIds.split(","))
                .map(String::trim).filter(value -> !value.isBlank()).toList();
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**").permitAll()
                        .requestMatchers("/api/admin/kafka/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                        .access((authentication, context) -> {
                            if (!(authentication.get() instanceof JwtAuthenticationToken token)) {
                                return new AuthorizationDecision(false);
                            }
                            Jwt jwt = token.getToken();
                            List<String> roles = jwt.getClaimAsStringList("roles");
                            boolean admin = roles != null && roles.contains("ADMIN")
                                    || administrators.contains(jwt.getClaimAsString("oid"));
                            String scopes = jwt.getClaimAsString("scp");
                            boolean scope = scopes != null && Arrays.asList(scopes.split(" ")).contains(requiredScope);
                            return new AuthorizationDecision(admin && scope);
                        })
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> {}));
        return http.build();
    }
}
