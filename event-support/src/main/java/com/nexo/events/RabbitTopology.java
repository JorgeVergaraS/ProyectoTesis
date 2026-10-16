package com.nexo.events;

import java.util.List;
import org.springframework.amqp.core.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Single topology contract shared by the API, workers and administration service. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class RabbitTopology {
    public static final String EVENTS = "nexo.events.topic";
    public static final String TASKS = "nexo.tasks.direct";
    public static final String DEAD_LETTERS = "nexo.failures.direct";
    public static final String MESSAGE_CREATED = "message.created";
    public static final String MESSAGE_PATTERN = "message.#";
    public static final String NOTIFICATIONS = "nexo.message.created";
    public static final String AUDIT = "nexo.message.audit";
    public static final String ACTIVITY = "nexo.conversation.activity";
    public static final String NOTIFICATIONS_DLQ = NOTIFICATIONS + ".failed";
    public static final String AUDIT_DLQ = AUDIT + ".failed";
    public static final String ACTIVITY_DLQ = ACTIVITY + ".failed";
    public static final List<String> QUEUES = List.of(NOTIFICATIONS, AUDIT, ACTIVITY);
    public static final List<String> DLQS = List.of(NOTIFICATIONS_DLQ, AUDIT_DLQ, ACTIVITY_DLQ);
    public static final List<String> EXCHANGES = List.of(EVENTS, TASKS, DEAD_LETTERS);

    @Bean
    public Declarables nexoTopology() {
        TopicExchange events = new TopicExchange(EVENTS, true, false);
        DirectExchange tasks = new DirectExchange(TASKS, true, false);
        DirectExchange failures = new DirectExchange(DEAD_LETTERS, true, false);
        Queue notifications = workQueue(NOTIFICATIONS, NOTIFICATIONS_DLQ);
        Queue audit = workQueue(AUDIT, AUDIT_DLQ);
        Queue activity = workQueue(ACTIVITY, ACTIVITY_DLQ);
        Queue notificationsDlq = new Queue(NOTIFICATIONS_DLQ, true);
        Queue auditDlq = new Queue(AUDIT_DLQ, true);
        Queue activityDlq = new Queue(ACTIVITY_DLQ, true);
        return new Declarables(events, tasks, failures,
                notifications, audit, activity, notificationsDlq, auditDlq, activityDlq,
                BindingBuilder.bind(tasks).to(events).with(MESSAGE_CREATED),
                BindingBuilder.bind(notifications).to(tasks).with(MESSAGE_CREATED),
                BindingBuilder.bind(audit).to(events).with(MESSAGE_PATTERN),
                BindingBuilder.bind(activity).to(events).with(MESSAGE_CREATED),
                BindingBuilder.bind(notificationsDlq).to(failures).with(NOTIFICATIONS_DLQ),
                BindingBuilder.bind(auditDlq).to(failures).with(AUDIT_DLQ),
                BindingBuilder.bind(activityDlq).to(failures).with(ACTIVITY_DLQ));
    }

    private Queue workQueue(String name, String failureKey) {
        return QueueBuilder.durable(name).deadLetterExchange(DEAD_LETTERS)
                .deadLetterRoutingKey(failureKey).build();
    }
}
