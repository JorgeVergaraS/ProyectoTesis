package com.nexo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "spring.config.import=")
@org.springframework.test.context.ActiveProfiles("test")
@AutoConfigureMockMvc
@Testcontainers
class NexoApplicationTests {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10-alpine")
            .withDatabaseName("nexo")
            .withUsername("nexo");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Flyway flyway;

    @Test
    void demoIsUnavailableWithoutExplicitProfile() throws Exception {
        mvc.perform(get("/api/demo/users")).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM nexo.users WHERE identity_provider='DEMO'", Integer.class)).isZero();
    }

    @Test
    void publicHealthDoesNotRequireAuthentication() throws Exception {
        mvc.perform(get("/api/public/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("nexo-backend"));
    }

    @Test
    void readinessIncludesLiveDatabase() throws Exception {
        assertThat(jdbc.queryForObject("SELECT 1", Integer.class)).isEqualTo(1);
        mvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void flywayCreatesDomainSchema() {
        Flyway restartedFlyway = Flyway.configure()
                .configuration(flyway.getConfiguration())
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .load();
        assertThat(restartedFlyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'nexo'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT success FROM public.flyway_schema_history WHERE version = '0'", Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'nexo' AND table_name = 'flyway_schema_history'", Integer.class))
                .isZero();
    }

    @Test
    void angularOriginIsAllowed() throws Exception {
        mvc.perform(options("/api/public/health")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
    }

    @Test
    void unknownOriginIsRejected() throws Exception {
        mvc.perform(options("/api/public/health")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void unknownEndpointUsesUniformError() throws Exception {
        mvc.perform(get("/api/public/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.path").value("/api/public/does-not-exist"))
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    void openApiDocumentsPublicHealth() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/public/health'].get").exists());
    }
}
