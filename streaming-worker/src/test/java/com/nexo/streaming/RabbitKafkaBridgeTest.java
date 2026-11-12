package com.nexo.streaming;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.rabbitmq.client.Channel;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

class RabbitKafkaBridgeTest {
    private final KafkaStreamPublisher publisher = mock(KafkaStreamPublisher.class);
    private final Channel channel = mock(Channel.class);
    private final RabbitKafkaBridge bridge = new RabbitKafkaBridge(publisher);

    @Test
    void publishesMetadataToKafkaThenAcknowledgesRabbitDelivery() throws Exception {
        String eventId = UUID.randomUUID().toString();
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(17);
        properties.setReceivedRoutingKey("message.created");
        properties.setType("message.created.v1");

        bridge.forward(new Message(eventId.getBytes(StandardCharsets.US_ASCII), properties), channel);

        verify(publisher).publish(any(NexoStreamEvent.class));
        verify(channel).basicAck(17, false);
        verify(channel, never()).basicReject(17, false);
    }

    @Test
    void rejectsMalformedEventIdToRabbitDeadLetterRouteWithoutPublishing() throws Exception {
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(18);

        bridge.forward(new Message("not-a-uuid".getBytes(StandardCharsets.US_ASCII), properties), channel);

        verify(publisher, never()).publish(any());
        verify(channel).basicReject(18, false);
    }
}
