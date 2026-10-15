package com.nexo.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
@RequestMapping("/api/admin/rabbit")
public class RabbitAdminController {
    private final RabbitAdminService service;
    public RabbitAdminController(RabbitAdminService service) { this.service = service; }
    @GetMapping("/topology") public Map<String,Object> topology() { return service.topology(); }
    @PostMapping("/queues") @ResponseStatus(HttpStatus.CREATED)
    public void queue(@Valid @RequestBody TopologyRequests.QueueRequest request) { service.createQueue(request); }
    @DeleteMapping("/queues/{name}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQueue(@PathVariable @Pattern(regexp = TopologyRequests.NAME) String name) { service.deleteQueue(name); }
    @PostMapping("/exchanges") @ResponseStatus(HttpStatus.CREATED)
    public void exchange(@Valid @RequestBody TopologyRequests.ExchangeRequest request) { service.createExchange(request); }
    @DeleteMapping("/exchanges/{name}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExchange(@PathVariable @Pattern(regexp = TopologyRequests.NAME) String name) { service.deleteExchange(name); }
    @PostMapping("/bindings") @ResponseStatus(HttpStatus.CREATED)
    public void binding(@Valid @RequestBody TopologyRequests.BindingRequest request) { service.createBinding(request); }
    @DeleteMapping("/bindings") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBinding(@Valid @RequestBody TopologyRequests.BindingRequest request) { service.deleteBinding(request); }
}
