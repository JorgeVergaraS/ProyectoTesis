package com.nexo.kafkaadmin;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.ConsumerGroupListing;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.ListOffsetsResult.ListOffsetsResultInfo;
import org.apache.kafka.clients.admin.AlterConfigOp.OpType;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry.ConfigSource;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.errors.TopicExistsException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KafkaAdminService {
    private static final long FUTURE_TIMEOUT_SECONDS = 12;
    private final AdminClient admin;

    public KafkaAdminService(AdminClient admin) {
        this.admin = admin;
    }

    public List<TopicSummary> topics() {
        try {
            Set<String> names = admin.listTopics().names().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (names.isEmpty()) return List.of();
            Map<String, TopicDescription> descriptions = admin.describeTopics(names).allTopicNames()
                    .get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            List<ConfigResource> resources = names.stream()
                    .map(name -> new ConfigResource(ConfigResource.Type.TOPIC, name)).toList();
            Map<ConfigResource, Config> configs = admin.describeConfigs(resources).all()
                    .get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return names.stream().sorted().map(name -> {
                TopicDescription description = descriptions.get(name);
                Config config = configs.get(new ConfigResource(ConfigResource.Type.TOPIC, name));
                Map<String, String> values = config.entries().stream()
                        .filter(entry -> entry.source() == ConfigSource.DYNAMIC_TOPIC_CONFIG)
                        .collect(Collectors.toUnmodifiableMap(ConfigEntry::name, ConfigEntry::value));
                int replicas = description.partitions().isEmpty() ? 0
                        : description.partitions().getFirst().replicas().size();
                return new TopicSummary(name, description.partitions().size(), replicas, values);
            }).toList();
        } catch (Exception error) {
            throw translate("Could not list Kafka topics", error);
        }
    }

    public TopicSummary create(KafkaAdminRequests.CreateTopicRequest request) {
        requireDemoTopic(request.name());
        try {
            int brokers = admin.describeCluster().nodes().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS).size();
            if (request.replicationFactor() > brokers) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Replication factor exceeds the available broker count");
            }
            NewTopic topic = new NewTopic(request.name(), request.partitions(), (short) request.replicationFactor())
                    .configs(Map.of("retention.ms", Long.toString(request.retentionMs()),
                            "min.insync.replicas", Integer.toString(request.minInsyncReplicas()),
                            "cleanup.policy", "delete"));
            admin.createTopics(List.of(topic)).all().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return topics().stream().filter(item -> item.name().equals(request.name())).findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Created topic was not visible"));
        } catch (ResponseStatusException known) {
            throw known;
        } catch (Exception error) {
            if (rootCause(error) instanceof TopicExistsException) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Topic already exists");
            }
            throw translate("Could not create Kafka topic", error);
        }
    }

    public void update(String name, KafkaAdminRequests.UpdateTopicConfigRequest request) {
        requireDemoTopic(name);
        try {
            if (!admin.listTopics().names().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS).contains(name)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic not found");
            }
            List<AlterConfigOp> changes = new ArrayList<>();
            if (request.retentionMs() != null) addChange(changes, "retention.ms", request.retentionMs().toString());
            if (request.minInsyncReplicas() != null) {
                addChange(changes, "min.insync.replicas", request.minInsyncReplicas().toString());
            }
            if (request.cleanupPolicy() != null) addChange(changes, "cleanup.policy", request.cleanupPolicy());
            var resource = new ConfigResource(ConfigResource.Type.TOPIC, name);
            admin.incrementalAlterConfigs(Map.of(resource, changes)).all()
                    .get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (ResponseStatusException known) {
            throw known;
        } catch (Exception error) {
            throw translate("Could not update Kafka topic configuration", error);
        }
    }

    public void delete(String name) {
        requireDemoTopic(name);
        try {
            admin.deleteTopics(List.of(name)).all().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception error) {
            throw translate("Could not delete Kafka topic", error);
        }
    }

    public List<ConsumerGroupSummary> consumerGroups() {
        try {
            Collection<ConsumerGroupListing> groups = admin.listConsumerGroups().all()
                    .get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (groups.isEmpty()) return List.of();
            var futures = admin.describeConsumerGroups(
                    groups.stream().map(ConsumerGroupListing::groupId).toList()).describedGroups();
            Map<String, ConsumerGroupDescription> descriptions = new HashMap<>();
            for (Map.Entry<String, org.apache.kafka.common.KafkaFuture<ConsumerGroupDescription>> entry : futures.entrySet()) {
                descriptions.put(entry.getKey(), entry.getValue().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS));
            }
            return descriptions.entrySet().stream().map(entry -> new ConsumerGroupSummary(
                    entry.getKey(), entry.getValue().state().toString(), entry.getValue().members().size(),
                    entry.getValue().members().stream().flatMap(member -> member.assignment().topicPartitions().stream())
                            .map(TopicPartition::topic).distinct().sorted().toList()))
                    .sorted(Comparator.comparing(ConsumerGroupSummary::groupId)).toList();
        } catch (Exception error) {
            throw translate("Could not list Kafka consumer groups", error);
        }
    }

    public GroupLag groupLag(String groupId) {
        if (groupId == null || !groupId.matches("[a-zA-Z0-9._-]{1,80}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid consumer group name");
        }
        try {
            Map<TopicPartition, OffsetAndMetadata> committed = admin.listConsumerGroupOffsets(groupId)
                    .partitionsToOffsetAndMetadata().get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (committed.isEmpty()) return new GroupLag(groupId, 0, List.of());
            Map<TopicPartition, OffsetSpec> requests = committed.keySet().stream()
                    .collect(Collectors.toMap(partition -> partition, partition -> OffsetSpec.latest()));
            Map<TopicPartition, ListOffsetsResultInfo> ends = admin.listOffsets(requests).all()
                    .get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            List<PartitionLag> partitions = committed.entrySet().stream().map(entry -> {
                long current = entry.getValue().offset();
                long end = ends.get(entry.getKey()).offset();
                return new PartitionLag(entry.getKey().topic(), entry.getKey().partition(), current, end,
                        Math.max(0, end - current));
            }).sorted(Comparator.comparing(PartitionLag::topic).thenComparingInt(PartitionLag::partition)).toList();
            return new GroupLag(groupId, partitions.stream().mapToLong(PartitionLag::lag).sum(), partitions);
        } catch (Exception error) {
            throw translate("Could not calculate consumer group lag", error);
        }
    }

    private void requireDemoTopic(String name) {
        if (name == null || !name.matches(KafkaAdminRequests.DEMO_TOPIC)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only nexo.demo.* topics can be changed");
        }
    }

    private static void addChange(List<AlterConfigOp> changes, String key, String value) {
        changes.add(new AlterConfigOp(new ConfigEntry(key, value), OpType.SET));
    }

    private static ResponseStatusException translate(String message, Exception error) {
        Throwable cause = rootCause(error);
        if (cause instanceof ResponseStatusException status) return status;
        if (cause instanceof TopicExistsException) return new ResponseStatusException(HttpStatus.CONFLICT, "Topic already exists");
        if (cause instanceof org.apache.kafka.common.errors.UnknownTopicOrPartitionException) {
            return new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic or partition not found");
        }
        if (cause instanceof java.util.concurrent.TimeoutException) {
            return new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, message);
        }
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
    }

    private static Throwable rootCause(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && (current instanceof ExecutionException
                || current instanceof java.util.concurrent.CompletionException)) current = current.getCause();
        return current;
    }

    public record TopicSummary(String name, int partitions, int replicationFactor, Map<String, String> config) {}
    public record ConsumerGroupSummary(String groupId, String state, int members, List<String> assignedTopics) {}
    public record PartitionLag(String topic, int partition, long committedOffset, long endOffset, long lag) {}
    public record GroupLag(String groupId, long totalLag, List<PartitionLag> partitions) {}
}
