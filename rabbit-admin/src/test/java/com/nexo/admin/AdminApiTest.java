package com.nexo.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RabbitAdminController.class)
@Import({AdminSecurity.class, AdminErrors.class})
class AdminApiTest {
    @Autowired MockMvc mvc;
    @MockitoBean RabbitAdminService service;
    @MockitoBean JwtDecoder decoder;
    org.springframework.test.web.servlet.request.RequestPostProcessor administrator() {
        return jwt().jwt(j -> j.claim("roles", java.util.List.of("ADMIN")).claim("scp", "access_as_user"));
    }
    @Test void requiresAuthenticationAndAdministrativePermission() throws Exception {
        mvc.perform(get("/api/admin/rabbit/topology")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/rabbit/topology").with(jwt().jwt(j -> j.claim("scp", "access_as_user"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/rabbit/topology").with(jwt().jwt(j -> j.claim("roles", java.util.List.of("ADMIN")))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void acceptsValidQueueAndRejectsEmptyNamesAndInvalidTtl() throws Exception {
        mvc.perform(post("/api/admin/rabbit/queues").with(administrator()).contentType("application/json")
                .content("{\"name\":\"nexo.demo.review\",\"durable\":true,\"ttlMillis\":60000}"))
                .andExpect(status().isCreated());
        verify(service).createQueue(any()); clearInvocations(service);
        for (String body : java.util.List.of("{\"name\":\"\",\"durable\":true}",
                "{\"name\":\"nexo.demo.bad\",\"durable\":true,\"ttlMillis\":-1}",
                "{\"name\":\"nexo.message.created\",\"durable\":true}")) {
            mvc.perform(post("/api/admin/rabbit/queues").with(administrator()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void rejectsUnknownExchangeTypesAndInvalidBindings() throws Exception {
        mvc.perform(post("/api/admin/rabbit/exchanges").with(administrator()).contentType("application/json")
                .content("{\"name\":\"nexo.demo.test\",\"type\":\"UNKNOWN\",\"durable\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/admin/rabbit/bindings").with(administrator()).contentType("application/json")
                .content("{\"queue\":\"nexo.demo.test\",\"exchange\":\"nexo.demo.events\",\"routingKey\":\"\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/admin/rabbit/queues/nexo.message.created").with(administrator()))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
