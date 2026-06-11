import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, showWebNotification } from '@/lib/webNotifications';
import { playChatSound } from '@/lib/notificationSounds';
import type { ChatMessage } from './useChat';

export function useCustomerChat() {
  const { user, profile } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get or create conversation for current user
  const getOrCreateConversation = useCallback(async () => {
    if (!user || !profile?.preferred_restaurant) return null;

    const site = profile.preferred_restaurant.toLowerCase().includes('conches') ? 'conches' : 'beaumont';

    // Try to find existing conversation
    const { data: existing } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('customer_id', user.id)
      .eq('site', site)
      .maybeSingle();

    if (existing) {
      setConversationId(existing.id);
      return existing.id;
    }

    // Create new conversation
    const customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Client';
    const { data: newConv, error } = await supabase
      .from('chat_conversations')
      .insert({
        customer_id: user.id,
        site,
        customer_name: customerName,
        customer_phone: profile.phone,
      })
      .select()
      .single();

    if (newConv && !error) {
      setConversationId(newConv.id);
      return newConv.id;
    }
    return null;
  }, [user, profile]);

  // Fetch messages
  const fetchMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as ChatMessage[]);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !profile?.preferred_restaurant) return;

    let convId = conversationId;
    if (!convId) {
      convId = await getOrCreateConversation();
    }
    if (!convId) return;

    const site = profile.preferred_restaurant.toLowerCase().includes('conches') ? 'conches' : 'beaumont';

    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_type: 'customer',
      content,
      site,
    });

    // Update conversation
    await supabase
      .from('chat_conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', convId);
  }, [user, profile, conversationId, getOrCreateConversation]);

  // Init & realtime
  useEffect(() => {
    if (!user || !profile?.preferred_restaurant) {
      setLoading(false);
      return;
    }

    const init = async () => {
      const convId = await getOrCreateConversation();
      if (convId) {
        await fetchMessages(convId);
      }
      setLoading(false);
    };
    init();
  }, [user, profile, getOrCreateConversation, fetchMessages]);

  // Realtime subscription based on conversationId
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`customer-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return { messages, loading, sendMessage, conversationId };
}
