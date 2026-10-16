package com.nexo.events;

import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReliableConsumerTest {
    PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    Channel channel = mock(Channel.class);
    ReliableConsumer consumer = new ReliableConsumer(transactions, 3);
    ReliableConsumerTest() { when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus()); }
    Message message(String payload) {
        var properties = new MessageProperties(); properties.setDeliveryTag(7); properties.setConsumerQueue(RabbitTopology.AUDIT);
        return new Message(payload.getBytes(StandardCharsets.UTF_8), properties);
    }
    @Test void acknowledgesOnlyAfterCommitAndDoesNotNackWhenAckTransportFails() throws Exception {
        doThrow(new IOException("connection closed")).when(channel).basicAck(7, false);
        assertThatThrownBy(() -> consumer.handle(message(UUID.randomUUID().toString()), channel, id -> {})).isInstanceOf(IOException.class);
        var order = inOrder(transactions, channel); order.verify(transactions).getTransaction(any());
        order.verify(transactions).commit(any()); order.verify(channel).basicAck(7, false);
        verify(channel, never()).basicNack(anyLong(), anyBoolean(), anyBoolean());
    }
    @Test void rejectsMalformedPayloadWithoutOpeningTransaction() throws Exception {
        consumer.handle(message("not-a-uuid"), channel, id -> fail("invalid event must not be processed"));
        verify(channel).basicReject(7, false); verifyNoInteractions(transactions);
    }
    @Test void retriesTransientFailureThenCommitsExactlyOnce() throws Exception {
        var attempts = new AtomicInteger();
        consumer.handle(message(UUID.randomUUID().toString()), channel, id -> {
            if (attempts.incrementAndGet() < 3) throw new TransientDataAccessResourceException("temporarily unavailable");
        });
        assertThat(attempts).hasValue(3); verify(transactions, times(2)).rollback(any());
        verify(transactions).commit(any()); verify(channel).basicAck(7, false);
    }
    @Test void rejectsPermanentFailureWithoutRequeueOrRetry() throws Exception {
        var attempts = new AtomicInteger();
        consumer.handle(message(UUID.randomUUID().toString()), channel, id -> {
            attempts.incrementAndGet(); throw new DataIntegrityViolationException("invalid reference");
        });
        assertThat(attempts).hasValue(1); verify(channel).basicNack(7, false, false);
        verify(transactions).rollback(any()); verify(transactions, never()).commit(any());
    }
    @Test void exhaustedTransientErrorsAreDeadLettered() throws Exception {
        consumer.handle(message(UUID.randomUUID().toString()), channel, id -> { throw new TransientDataAccessResourceException("offline"); });
        verify(transactions, times(3)).rollback(any()); verify(channel).basicNack(7, false, false);
        verify(channel, never()).basicAck(anyLong(), anyBoolean());
    }
}
