package com.nexo.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.auth.demo.DemoSessions;
import com.nexo.common.response.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain security(HttpSecurity http, ObjectProvider<DemoSessions> sessions,
                                 ObjectMapper json, Environment environment) throws Exception {
        boolean demo = environment.acceptsProfiles(Profiles.of("local-demo"));
        if (demo && environment.acceptsProfiles(Profiles.of("prod", "production"))) {
            throw new IllegalStateException("local-demo must never run with a production profile");
        }
        http.cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(c -> c.disable())
                .formLogin(c -> c.disable())
                .httpBasic(c -> c.disable())
                .logout(c -> c.disable())
                // Demo API uses explicit bearer headers, never browser cookies.
                .csrf(c -> { if (demo) c.ignoringRequestMatchers("/api/demo/**"); })
                .exceptionHandling(c -> c
                        .authenticationEntryPoint((req, res, error) -> writeError(json, req, res, 401, "Unauthorized"))
                        .accessDeniedHandler((req, res, error) -> writeError(json, req, res, 403, "Forbidden")))
                .authorizeHttpRequests(c -> {
                    c.requestMatchers("/api/public/**", "/actuator/health/**", "/actuator/info",
                            "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                    if (demo) {
                        c.requestMatchers(HttpMethod.GET, "/api/demo/users").permitAll();
                        c.requestMatchers(HttpMethod.GET, "/api/demo/avatars/**").permitAll();
                        c.requestMatchers(HttpMethod.POST, "/api/demo/sessions").permitAll();
                        c.requestMatchers("/api/demo/**").hasRole("DEMO");
                    }
                    c.anyRequest().denyAll();
                });
        if (demo) {
            DemoSessions service = sessions.getObject();
            http.addFilterBefore(new OncePerRequestFilter() {
                @Override
                protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                        throws ServletException, IOException {
                    String header = request.getHeader("Authorization");
                    if (request.getRequestURI().startsWith("/api/demo/") && header != null) {
                        var principal = header.startsWith("Bearer ") ? service.authenticate(header.substring(7)) : java.util.Optional.<com.nexo.auth.demo.DemoPrincipal>empty();
                        if (principal.isEmpty()) { writeError(json, request, response, 401, "Unauthorized"); return; }
                        var authentication = UsernamePasswordAuthenticationToken.authenticated(principal.get(), null,
                                List.of(new SimpleGrantedAuthority("ROLE_DEMO")));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                    chain.doFilter(request, response);
                }
            }, AnonymousAuthenticationFilter.class);
        }
        return http.build();
    }

    private static void writeError(ObjectMapper json, HttpServletRequest req, HttpServletResponse res,
                                   int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        if (status == 401) res.setHeader("WWW-Authenticate", "Bearer");
        json.writeValue(res.getOutputStream(), new ApiError(Instant.now(), status, message, message, req.getRequestURI()));
    }
}
