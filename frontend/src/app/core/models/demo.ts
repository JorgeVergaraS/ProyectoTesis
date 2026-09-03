export interface DemoUser {
  id: string;
  username: string;
  displayName: string;
  color: string;
  bio: string;
  availability?: 'AVAILABLE' | 'BUSY' | 'AWAY';
  online: boolean;
  avatarUrl?: string | null;
  email?: string | null;
}
export interface DemoSession {
  token: string;
  expiresAt: string;
  user: DemoUser;
}
export type AuthSessionKind = 'demo' | 'local' | 'microsoft';
export interface Conversation {
  id: string;
  kind: 'CHANNEL' | 'DIRECT';
  title: string;
  description: string;
  slug: string | null;
  joined: boolean;
  memberCount: number;
  peerId: string | null;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  body: string;
  sentAt: string;
  senderAvatarUrl?: string | null;
}
export interface Workspace {
  channels: Conversation[];
  directs: Conversation[];
  people: DemoUser[];
}
