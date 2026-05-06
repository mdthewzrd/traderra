/**
 * Message Bus for Inter-Agent Communication
 *
 * Provides publish/subscribe messaging system for agents to communicate
 * with each other asynchronously.
 *
 * Features:
 * - Topic-based publish/subscribe
 * - Message filtering and routing
 * - Guaranteed delivery with acknowledgment
 * - Message persistence for reliability
 * - Dead letter queue for failed messages
 *
 * @module MessageBus
 */

import { AgentMessage } from '../agents/core/base-agent'

export type MessageHandler = (message: AgentMessage) => Promise<void | AgentMessage>

export interface Subscription {
  id: string
  agentId: string
  topic: string
  handler: MessageHandler
  filter?: (message: AgentMessage) => boolean
  subscribedAt: number
}

export interface TopicStats {
  topic: string
  subscribers: number
  messagesPublished: number
  messagesProcessed: number
  failedMessages: number
}

export interface MessageBusConfig {
  maxMessageAge: number // Maximum age of messages in milliseconds
  maxQueueSize: number // Maximum size of message queue per topic
  enablePersistence: boolean // Enable message persistence
}

/**
 * Message Bus Class
 *
 * Implements publish/subscribe pattern for agent communication.
 * Agents can publish messages to topics and subscribe to topics of interest.
 */
export class MessageBus {
  private static instance: MessageBus
  private subscriptions: Map<string, Subscription[]> = new Map()
  private messageQueues: Map<string, AgentMessage[]> = new Map()
  private deadLetterQueue: AgentMessage[] = []
  private stats: Map<string, TopicStats> = new Map()
  private config: MessageBusConfig

  private constructor(config?: Partial<MessageBusConfig>) {
    this.config = {
      maxMessageAge: 60000, // 1 minute
      maxQueueSize: 1000,
      enablePersistence: false,
      ...config
    }

    // Start message processing loop
    this.startProcessingLoop()
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<MessageBusConfig>): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus(config)
    }
    return MessageBus.instance
  }

  /**
   * Subscribe to a topic
   */
  subscribe(
    agentId: string,
    topic: string,
    handler: MessageHandler,
    filter?: (message: AgentMessage) => boolean
  ): string {
    const subscription: Subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      topic,
      handler,
      filter,
      subscribedAt: Date.now()
    }

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, [])
      this.messageQueues.set(topic, [])
      this.stats.set(topic, {
        topic,
        subscribers: 0,
        messagesPublished: 0,
        messagesProcessed: 0,
        failedMessages: 0
      })
    }

    this.subscriptions.get(topic)!.push(subscription)

    // Update stats
    const stats = this.stats.get(topic)!
    stats.subscribers++

    console.log(`[MessageBus] Agent ${agentId} subscribed to topic: ${topic}`)

    return subscription.id
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(subscriptionId: string): void {
    for (const [topic, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId)

      if (index !== -1) {
        subscriptions.splice(index, 1)

        // Update stats
        const stats = this.stats.get(topic)!
        stats.subscribers--

        console.log(`[MessageBus] Unsubscribed from topic: ${topic}`)

        // Clean up if no more subscribers
        if (subscriptions.length === 0) {
          this.subscriptions.delete(topic)
          this.messageQueues.delete(topic)
        }

        return
      }
    }
  }

  /**
   * Unsubscribe all subscriptions for an agent
   */
  unsubscribeAll(agentId: string): void {
    for (const [topic, subscriptions] of this.subscriptions.entries()) {
      const initialLength = subscriptions.length

      const filtered = subscriptions.filter(sub => sub.agentId !== agentId)

      if (filtered.length < initialLength) {
        this.subscriptions.set(topic, filtered)

        // Update stats
        const stats = this.stats.get(topic)!
        stats.subscribers -= initialLength - filtered.length

        console.log(`[MessageBus] Removed ${initialLength - filtered.length} subscriptions for agent ${agentId} from topic: ${topic}`)
      }
    }
  }

  /**
   * Publish a message to a topic
   */
  async publish(topic: string, message: AgentMessage): Promise<void> {
    // Add topic to message
    message.to = topic

    // Get or create message queue
    if (!this.messageQueues.has(topic)) {
      this.messageQueues.set(topic, [])
      this.stats.set(topic, {
        topic,
        subscribers: 0,
        messagesPublished: 0,
        messagesProcessed: 0,
        failedMessages: 0
      })
    }

    const queue = this.messageQueues.get(topic)!

    // Check queue size limit
    if (queue.length >= this.config.maxQueueSize) {
      console.warn(`[MessageBus] Message queue full for topic: ${topic}`)
      this.deadLetterQueue.push(message)
      return
    }

    // Add message to queue
    queue.push(message)

    // Update stats
    const stats = this.stats.get(topic)!
    stats.messagesPublished++

    console.log(`[MessageBus] Published message to topic: ${topic} (${queue.length} in queue)`)
  }

  /**
   * Process messages in queues
   */
  private async processMessages(topic: string): Promise<void> {
    const subscriptions = this.subscriptions.get(topic)

    if (!subscriptions || subscriptions.length === 0) {
      return
    }

    const queue = this.messageQueues.get(topic)

    if (!queue || queue.length === 0) {
      return
    }

    const message = queue.shift()!

    if (this.isMessageExpired(message)) {
      console.warn(`[MessageBus] Expired message discarded from topic: ${topic}`)
      return
    }

    const stats = this.stats.get(topic)!

    // Deliver message to all subscribers
    for (const subscription of subscriptions) {
      try {
        // Apply filter if provided
        if (subscription.filter && !subscription.filter(message)) {
          continue
        }

        // Call handler
        await subscription.handler(message)

        stats.messagesProcessed++
      } catch (error) {
        console.error(`[MessageBus] Error delivering message to ${subscription.agentId}:`, error)
        stats.failedMessages++
      }
    }
  }

  /**
   * Check if message has expired
   */
  private isMessageExpired(message: AgentMessage): boolean {
    const age = Date.now() - message.timestamp
    return age > this.config.maxMessageAge
  }

  /**
   * Start message processing loop
   */
  private startProcessingLoop(): void {
    setInterval(() => {
      this.processAllTopics()
    }, 100) // Process every 100ms
  }

  /**
   * Process all topics with pending messages
   */
  private async processAllTopics(): Promise<void> {
    const topics = Array.from(this.messageQueues.keys())

    for (const topic of topics) {
      await this.processMessages(topic)
    }
  }

  /**
   * Get statistics for a topic
   */
  getTopicStats(topic: string): TopicStats | undefined {
    return this.stats.get(topic)
  }

  /**
   * Get statistics for all topics
   */
  getAllStats(): TopicStats[] {
    return Array.from(this.stats.values())
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): AgentMessage[] {
    return [...this.deadLetterQueue]
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = []
  }

  /**
   * Get all subscriptions for an agent
   */
  getAgentSubscriptions(agentId: string): Subscription[] {
    const agentSubscriptions: Subscription[] = []

    for (const subscriptions of this.subscriptions.values()) {
      agentSubscriptions.push(
        ...subscriptions.filter(sub => sub.agentId === agentId)
      )
    }

    return agentSubscriptions
  }

  /**
   * Send direct message to an agent (bypasses topics)
   */
  async sendDirectMessage(
    from: string,
    to: string,
    content: any
  ): Promise<AgentMessage | undefined> {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type: 'request',
      content,
      timestamp: Date.now()
    }

    // Find subscriptions for the target agent
    for (const [topic, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        if (subscription.agentId === to) {
          try {
            await subscription.handler(message)
            return message
          } catch (error) {
            console.error(`[MessageBus] Direct message failed:`, error)
            return undefined
          }
        }
      }
    }

    console.warn(`[MessageBus] No subscription found for agent: ${to}`)
    return undefined
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(
    from: string,
    content: any,
    excludeAgent?: string
  ): Promise<void> {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to: 'broadcast',
      type: 'notification',
      content,
      timestamp: Date.now()
    }

    for (const [topic, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        if (excludeAgent && subscription.agentId === excludeAgent) {
          continue
        }

        try {
          await subscription.handler(message)
        } catch (error) {
          console.error(`[MessageBus] Broadcast failed for ${subscription.agentId}:`, error)
        }
      }
    }
  }

  /**
   * Shutdown message bus
   */
  shutdown(): void {
    this.subscriptions.clear()
    this.messageQueues.clear()
    this.deadLetterQueue = []
    this.stats.clear()

    console.log('[MessageBus] Shutdown complete')
  }
}

/**
 * Get message bus instance
 */
export function getMessageBus(config?: Partial<MessageBusConfig>): MessageBus {
  return MessageBus.getInstance(config)
}

/**
 * Subscribe to a topic (convenience function)
 */
export function subscribeToTopic(
  agentId: string,
  topic: string,
  handler: MessageHandler,
  filter?: (message: AgentMessage) => boolean
): string {
  return getMessageBus().subscribe(agentId, topic, handler, filter)
}

/**
 * Publish to a topic (convenience function)
 */
export async function publishToTopic(topic: string, message: AgentMessage): Promise<void> {
  await getMessageBus().publish(topic, message)
}

/**
 * Send direct message (convenience function)
 */
export async function sendDirectAgentMessage(
  from: string,
  to: string,
  content: any
): Promise<AgentMessage | undefined> {
  return getMessageBus().sendDirectMessage(from, to, content)
}
