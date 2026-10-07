import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ChatConversation } from '@/hooks/useChat';

const unreadConversation: ChatConversation = {
  id: 'conversation-1',
  customer_id: 'customer-1',
  customer_name: 'Cassandra Bouley',
  customer_phone: '33614217105',
  site: 'conches',
  last_message: 'Bonjour, pouvez-vous me renseigner ?',
  last_message_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  unread_count: 1,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, loading: false }),
}));

vi.mock('@/contexts/AdminContext', () => ({
  useAdmin: () => ({
    canManageChat: true,
    isSuperAdmin: false,
    isSiteAdminConches: true,
    isSiteAdminBeaumont: false,
    loading: false,
  }),
}));

vi.mock('@/hooks/useAdminPresence', () => ({
  useAdminPresenceBroadcast: () => undefined,
}));

vi.mock('@/components/admin/NotificationBell', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useChat', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useChat')>('@/hooks/useChat');
  return {
    ...actual,
    useChat: () => {
      const [conversations, setConversations] = useState([unreadConversation]);
      const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

      return {
        conversations,
        messages: [],
        selectedConversationId,
        refreshing: false,
        selectConversation: (id: string) => {
          setSelectedConversationId(id);
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === id ? { ...conversation, unread_count: 0 } : conversation,
            ),
          );
        },
        sendMessage: vi.fn(),
        deleteConversation: vi.fn(),
      };
    },
  };
});

import AdminChatPage from './AdminChatPage';

describe('AdminChatPage', () => {
  it('affiche Nouveau pour un message non lu puis le retire à l’ouverture', () => {
    render(
      <MemoryRouter initialEntries={['/admin/chat']}>
        <AdminChatPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nouveau')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cassandra Bouley/i }));

    expect(screen.queryByText('Nouveau')).not.toBeInTheDocument();
    expect(screen.getByText('Bonjour, pouvez-vous me renseigner ?')).toBeInTheDocument();
  });
});