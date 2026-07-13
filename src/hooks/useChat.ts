import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatConversation {
  id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  site: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'admin';
  content: string;
  site: string;
  created_at: string;
  read_at: string | null;
}

export function useChat(siteFilter?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false });

    if (siteFilter && siteFilter !== 'all') {
      query = query.eq('site', siteFilter);
    }

    const { data } = await query;
    if (data) {
      setConversations(data as ChatConversation[]);
    }
    setLoading(false);
  }, [siteFilter]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as ChatMessage[]);
    }
  }, []);

  // Send message as admin
  const sendMessage = useCallback(async (conversationId: string, content: string, site: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_type: 'admin',
        content,
        site,
      });

    if (!error) {
      // Update conversation last message
      await supabase
        .from('chat_conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    return { error };
  }, [user]);

  // Mark customer messages in a conversation as read (admin is the reader)
  const markMessagesRead = useCallback(async (conversationId: string) => {
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .is('read_at', null);
  }, []);

  // Select conversation
  const selectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    fetchMessages(id);
    markMessagesRead(id);
  }, [fetchMessages, markMessagesRead]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    fetchConversations();

    // Subscribe to new messages
    const msgChannel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Add to current messages if viewing this conversation
          if (newMsg.conversation_id === selectedConversationId) {
            setMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const convChannel = supabase
      .channel('chat-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(convChannel);
    };
  }, [user, fetchConversations, selectedConversationId]);

  return {
    conversations,
    messages,
    selectedConversationId,
    loading,
    selectConversation,
    sendMessage,
    refresh: fetchConversations,
  };
}
