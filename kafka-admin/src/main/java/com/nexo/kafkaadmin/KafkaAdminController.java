package com.nexo.kafkaadmin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

@RestController
@Validated
@RequestMapping("/api/admin/kafka")
public class KafkaAdminController {
    private final KafkaAdminService service;

    public KafkaAdminController(KafkaAdminService service) {
        this.service = service;
    }

    @GetMapping("/topics")
    public List<KafkaAdminService.TopicSummary> topics() {
        return service.topics();
    }

    @PostMapping("/topics")
    @ResponseStatus(HttpStatus.CREATED)
    public KafkaAdminService.TopicSummary create(@Valid @RequestBody KafkaAdminRequests.CreateTopicRequest request) {
        return service.create(request);
    }

    @PutMapping("/topics/{name}/config")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@PathVariable @Pattern(regexp = KafkaAdminRequests.DEMO_TOPIC) String name,
            @Valid @RequestBody KafkaAdminRequests.UpdateTopicConfigRequest request) {
        service.update(name, request);
    }

    @DeleteMapping("/topics/{name}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @Pattern(regexp = KafkaAdminRequests.DEMO_TOPIC) String name) {
        service.delete(name);
    }

    @GetMapping("/consumer-groups")
    public List<KafkaAdminService.ConsumerGroupSummary> groups() {
        return service.consumerGroups();
    }

    @GetMapping("/consumer-groups/{groupId}/lag")
    public KafkaAdminService.GroupLag lag(@PathVariable String groupId) {
        return service.groupLag(groupId);
    }
}
