package com.nexo.admin;

import com.nexo.events.RabbitTopology;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

/** Administrative AMQP operations stay behind a service and a restricted resource namespace. */
@Service
public class RabbitAdminService {
    private final RabbitAdmin admin;
    public RabbitAdminService(RabbitAdmin admin) { this.admin = admin; }

    public void createQueue(TopologyRequests.QueueRequest request) {
        Map<String,Object> args = new LinkedHashMap<>();
        if (request.ttlMillis() != null) args.put("x-message-ttl", request.ttlMillis());
        admin.declareQueue(new Queue(request.name(), request.durable(), false, false, args));
    }
    public void deleteQueue(String name) {
        requireDemoName(name);
        // Refuse deletion while consumers or pending messages exist.
        admin.deleteQueue(name, true, true);
    }
    public void createExchange(TopologyRequests.ExchangeRequest request) {
        Exchange exchange = switch (request.type()) {
            case DIRECT -> new DirectExchange(request.name(), request.durable(), false);
            case TOPIC -> new TopicExchange(request.name(), request.durable(), false);
        };
        admin.declareExchange(exchange);
    }
    public void deleteExchange(String name) {
        requireDemoName(name);
        admin.deleteExchange(name);
    }
    private Binding binding(TopologyRequests.BindingRequest request) {
        if (admin.getQueueInfo(request.queue()) == null) throw new ResponseStatusException(NOT_FOUND, "Queue not found");
        return new Binding(request.queue(), Binding.DestinationType.QUEUE,
                request.exchange(), request.routingKey(), null);
    }
    public void createBinding(TopologyRequests.BindingRequest request) { admin.declareBinding(binding(request)); }
    public void deleteBinding(TopologyRequests.BindingRequest request) { admin.removeBinding(binding(request)); }
    public Map<String,Object> topology() {
        List<Map<String,Object>> queues = java.util.stream.Stream.concat(RabbitTopology.QUEUES.stream(), RabbitTopology.DLQS.stream())
                .map(name -> {
                    var info = admin.getQueueInfo(name);
                    return Map.<String,Object>of("name", name, "available", info != null,
                            "messages", info == null ? 0 : info.getMessageCount(),
                            "consumers", info == null ? 0 : info.getConsumerCount());
                }).toList();
        return Map.of("queues", queues, "exchanges", RabbitTopology.EXCHANGES,
                "administrationNamespace", "nexo.demo.*");
    }
    private void requireDemoName(String name) {
        if (name == null || !name.matches(TopologyRequests.NAME))
            throw new ResponseStatusException(BAD_REQUEST, "Only nexo.demo.* resources can be administered");
    }
}
