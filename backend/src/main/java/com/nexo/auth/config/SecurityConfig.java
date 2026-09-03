package com.nexo.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.auth.demo.DemoPrincipal;
import com.nexo.auth.demo.DemoSessions;
import com.nexo.common.response.ApiError;
import com.nimbusds.jwt.JWTParser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class SecurityConfig {
    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);
    private static final String LOCAL_ISSUER = "nexo-local";
    private static final String LOCAL_AUDIENCE = "nexo-api";

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain security(
            HttpSecurity http,
            ObjectProvider<DemoSessions> sessions,
            ObjectMapper json,
            Environment environment,
            AuthenticationManager bearerAuthenticationManager) throws Exception {
        rejectUnsafeProfileCombination(environment);
        boolean demo = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("local-demo"));
        String requiredScope = environment.getProperty("nexo.azure.required-scope", "access_as_user");

        http.cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .formLogin(login -> login.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .csrf(csrf -> csrf.disable())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) ->
                                writeError(json, request, response, 401, "Unauthorized"))
                        .accessDeniedHandler((request, response, error) ->
                                writeError(json, request, response, 403, "Forbidden")))
                .authorizeHttpRequests(authorize -> {
                    authorize.requestMatchers(
                                    "/api/public/**",
                                    "/api/auth/**",
                                    "/api/avatars/**",
                                    "/actuator/health/**",
                                    "/actuator/info",
                                    "/swagger-ui/**",
                                    "/swagger-ui.html",
                                    "/v3/api-docs/**")
                            .permitAll();
                    if (demo) {
                        authorize.requestMatchers(
                                        "/api/demo/users", "/api/demo/avatars/**", "/api/demo/sessions")
                                .permitAll();
                        authorize.requestMatchers("/api/demo/**").hasRole("DEMO");
                    }
                    authorize.requestMatchers("/api/admin/**").hasRole("ADMIN");
                    authorize.requestMatchers(
                                    "/api/users/me",
                                    "/api/users/me/**",
                                    "/api/workspace",
                                    "/api/directs",
                                    "/api/calls",
                                    "/api/calls/**",
                                    "/api/conversations/**")
                            .access((authentication, context) -> new AuthorizationDecision(
                                    hasAuthority(authentication.get(), "ROLE_USER")
                                            || hasAuthority(authentication.get(), "ROLE_DEMO")
                                            || hasAuthority(authentication.get(), "SCOPE_" + requiredScope)));
                    authorize.anyRequest().denyAll();
                });

        if (demo) {
            addDemoFilter(http, sessions.getObject(), json);
            addJwtBearerFilter(http, bearerAuthenticationManager, json);
        } else {
            http.addFilterBefore(
                    new BearerTokenAuthenticationFilter(bearerAuthenticationManager),
                    UsernamePasswordAuthenticationFilter.class);
        }
        return http.build();
    }

    static void rejectUnsafeProfileCombination(Environment environment) {
        boolean demo = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("local-demo"));
        boolean production = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "production"));
        if (demo && production) {
            throw new IllegalStateException("The local-demo and production profiles cannot be active together");
        }
    }

    @Bean
    AuthenticationManager bearerAuthenticationManager(Environment environment) {
        String secret = environment.getRequiredProperty("nexo.jwt.secret");
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("NEXO_JWT_SECRET must contain at least 32 bytes");
        }

        NimbusJwtDecoder local = NimbusJwtDecoder.withSecretKey(
                        new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .build();
        local.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(LOCAL_ISSUER), audience(LOCAL_AUDIENCE)));

        String issuer = environment.getRequiredProperty("nexo.azure.issuer");
        String legacyIssuer = environment.getProperty(
                "nexo.azure.legacy-issuer",
                "https://sts.windows.net/21a4bbb2-fc48-4053-a98e-b805aa2306cc/");
        String audience = environment.getRequiredProperty("nexo.azure.audience");
        String jwkSetUri = environment.getRequiredProperty("nexo.azure.jwk-set-uri");
        NimbusJwtDecoder entra = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        entra.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                issuer(issuer, legacyIssuer), audience(audience)));

        return authentication -> {
            try {
                String token = ((BearerTokenAuthenticationToken) authentication).getToken();
                String tokenIssuer = JWTParser.parse(token).getJWTClaimsSet().getIssuer();
                Jwt jwt = (LOCAL_ISSUER.equals(tokenIssuer) ? local : entra).decode(token);
                return new JwtAuthenticationToken(jwt, authorities(jwt));
            } catch (Exception invalidToken) {
                log.warn("Bearer token rejected: type={}", invalidToken.getClass().getSimpleName());
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("invalid_token"), "Invalid bearer token");
            }
        };
    }

    static OAuth2TokenValidator<Jwt> audience(String expected) {
        List<String> expectedAudiences = expected == null ? List.of()
                : java.util.Arrays.stream(expected.split(","))
                        .map(String::trim)
                        .filter(value -> !value.isBlank())
                        .toList();
        return token -> !expectedAudiences.isEmpty()
                && token.getAudience().stream().anyMatch(expectedAudiences::contains)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Invalid audience", null));
    }

    static OAuth2TokenValidator<Jwt> issuer(String expected, String legacy) {
        OAuth2TokenValidator<Jwt> timestamps = JwtValidators.createDefault();
        return token -> {
            String actual = token.getIssuer() == null ? "" : token.getIssuer().toString();
            return expected.equals(actual) || legacy.equals(actual)
                    ? timestamps.validate(token)
                    : OAuth2TokenValidatorResult.failure(
                            new OAuth2Error("invalid_token", "Invalid issuer", null));
        };
    }

    static Collection<GrantedAuthority> authorities(Jwt jwt) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        addScopes(authorities, jwt.getClaimAsString("scp"));
        addScopes(authorities, jwt.getClaimAsString("scope"));
        Object rolesClaim = jwt.getClaims().get("roles");
        if (rolesClaim instanceof Collection<?> roles) {
            roles.stream()
                    .map(String::valueOf)
                    .filter(role -> !role.isBlank())
                    .map(role -> "ROLE_" + role.toUpperCase(Locale.ROOT))
                    .map(SimpleGrantedAuthority::new)
                    .forEach(authorities::add);
        }
        return authorities.stream().distinct().toList();
    }

    private static void addScopes(List<GrantedAuthority> authorities, String scopes) {
        if (scopes == null || scopes.isBlank()) return;
        for (String scope : scopes.trim().split("\\s+")) {
            authorities.add(new SimpleGrantedAuthority("SCOPE_" + scope));
        }
    }

    private static boolean hasAuthority(Authentication authentication, String expected) {
        return authentication != null
                && authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .anyMatch(expected::equals);
    }

    private static void addDemoFilter(HttpSecurity http, DemoSessions service, ObjectMapper json) {
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(
                    HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                String header = request.getHeader("Authorization");
                if (request.getRequestURI().startsWith("/api/demo/") && header != null) {
                    var principal = header.startsWith("Bearer ")
                            ? service.authenticate(header.substring(7))
                            : java.util.Optional.<DemoPrincipal>empty();
                    if (principal.isEmpty()) {
                        writeError(json, request, response, 401, "Unauthorized");
                        return;
                    }
                    SecurityContextHolder.getContext().setAuthentication(
                            UsernamePasswordAuthenticationToken.authenticated(
                                    principal.get(),
                                    null,
                                    List.of(new SimpleGrantedAuthority("ROLE_DEMO"))));
                }
                chain.doFilter(request, response);
            }
        }, BearerTokenAuthenticationFilter.class);
    }

    private static void addJwtBearerFilter(
            HttpSecurity http, AuthenticationManager manager, ObjectMapper json) {
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(
                    HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                String path = request.getRequestURI();
                if (!isJwtProtectedPath(path)) {
                    chain.doFilter(request, response);
                    return;
                }
                String header = request.getHeader("Authorization");
                if (header == null || !header.startsWith("Bearer ")) {
                    chain.doFilter(request, response);
                    return;
                }
                try {
                    Authentication authentication = manager.authenticate(
                            new BearerTokenAuthenticationToken(header.substring(7)));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    chain.doFilter(request, response);
                } catch (Exception invalidToken) {
                    writeError(json, request, response, 401, "Unauthorized");
                }
            }
        }, UsernamePasswordAuthenticationFilter.class);
    }

    private static boolean isJwtProtectedPath(String path) {
        return path.equals("/api/users/me")
                || path.startsWith("/api/users/me/")
                || path.equals("/api/workspace")
                || path.equals("/api/directs")
                || path.equals("/api/calls")
                || path.startsWith("/api/calls/")
                || path.startsWith("/api/conversations/")
                || path.startsWith("/api/admin/");
    }

    private static void writeError(
            ObjectMapper json,
            HttpServletRequest request,
            HttpServletResponse response,
            int status,
            String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        if (status == 401) response.setHeader("WWW-Authenticate", "Bearer");
        json.writeValue(
                response.getOutputStream(),
                new ApiError(Instant.now(), status, message, message, request.getRequestURI()));
    }
}
