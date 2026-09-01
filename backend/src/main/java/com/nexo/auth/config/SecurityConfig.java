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
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecurityFilterChain security(HttpSecurity http, ObjectProvider<DemoSessions> sessions,
                                 ObjectMapper json, Environment environment,
                                 AuthenticationManager bearerAuthenticationManager) throws Exception {
        boolean demo = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("local-demo"));
        http.cors(Customizer.withDefaults()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(c -> c.disable()).formLogin(c -> c.disable()).httpBasic(c -> c.disable())
                .logout(c -> c.disable()).csrf(c -> c.disable())
                .exceptionHandling(c -> c.authenticationEntryPoint((req, res, error) -> writeError(json, req, res, 401, "Unauthorized"))
                        .accessDeniedHandler((req, res, error) -> writeError(json, req, res, 403, "Forbidden")))
                .authorizeHttpRequests(c -> {
                    c.requestMatchers("/api/public/**", "/api/auth/**", "/actuator/health/**", "/actuator/info",
                            "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                    if (demo) {
                        c.requestMatchers("/api/demo/users", "/api/demo/avatars/**", "/api/demo/sessions").permitAll();
                        c.requestMatchers("/api/demo/**").hasRole("DEMO");
                    }
                    c.requestMatchers("/api/admin/**").hasRole("ADMIN").requestMatchers("/api/users/me").authenticated();
                    c.anyRequest().denyAll();
                });
        if (demo) addDemoFilter(http, sessions.getObject(), json);
        if (!demo) http.addFilterBefore(new BearerTokenAuthenticationFilter(bearerAuthenticationManager), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    AuthenticationManager bearerAuthenticationManager(Environment environment) {
        String secret = environment.getProperty("nexo.jwt.secret", "change-me-in-local-env-please-32-bytes");
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) throw new IllegalStateException("NEXO_JWT_SECRET must contain at least 32 bytes");
        SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder local = NimbusJwtDecoder.withSecretKey(key).build();
        local.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer("nexo-local"), audience("nexo-api")));
        String issuer = environment.getProperty("nexo.azure.issuer");
        JwtDecoder entra = issuer == null || issuer.isBlank() ? null : JwtDecoders.fromIssuerLocation(issuer);
        if (entra instanceof NimbusJwtDecoder decoder) decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), audience(environment.getProperty("nexo.azure.audience", ""))));
        return authentication -> {
            try {
                String token = ((BearerTokenAuthenticationToken) authentication).getToken();
                String issuerClaim = JWTParser.parse(token).getJWTClaimsSet().getIssuer();
                Jwt jwt = ("nexo-local".equals(issuerClaim) ? local : entra).decode(token);
                return new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                        jwt, List.of(new SimpleGrantedAuthority("ROLE_USER")));
            } catch (Exception ignored) { }
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_token"), "Invalid bearer token");
        };
    }

    private static OAuth2TokenValidator<Jwt> audience(String expected) {
        return token -> expected != null && !expected.isBlank() && token.getAudience().contains(expected)
                ? OAuth2TokenValidatorResult.success() : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid audience", null));
    }

    private static void addDemoFilter(HttpSecurity http, DemoSessions service, ObjectMapper json) {
        http.addFilterBefore(new OncePerRequestFilter() {
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
                String header = request.getHeader("Authorization");
                if (request.getRequestURI().startsWith("/api/demo/") && header != null) {
                    var principal = header.startsWith("Bearer ") ? service.authenticate(header.substring(7)) : java.util.Optional.<DemoPrincipal>empty();
                    if (principal.isEmpty()) { writeError(json, request, response, 401, "Unauthorized"); return; }
                    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal.get(), null, List.of(new SimpleGrantedAuthority("ROLE_DEMO"))));
                }
                chain.doFilter(request, response);
            }
        }, BearerTokenAuthenticationFilter.class);
    }

    private static void writeError(ObjectMapper json, HttpServletRequest req, HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status); res.setContentType("application/json"); if (status == 401) res.setHeader("WWW-Authenticate", "Bearer");
        json.writeValue(res.getOutputStream(), new ApiError(Instant.now(), status, message, message, req.getRequestURI()));
    }
}
