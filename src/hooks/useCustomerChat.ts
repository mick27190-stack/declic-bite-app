import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { requestNotificationPermission, showWebNotification } from '@/lib/webNotifications';
import { playChatSound } from '@/lib/notificationSounds';
import type { ChatMessage } from './useChat';

export function useCustomerChat() {
  const { user, profile } = useAuth();
  const { selectedRestaurant } = useCart();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Active site: the restaurant selected for ordering takes priority,
  // then fall back to the customer's preferred restaurant from their profile.
  const resolveSite = useCallback((): 'conches' | 'beaumont' | null => {
    const source = selectedRestaurant?.id ?? selectedRestaurant?.name ?? profile?.preferred_restaurant;
    if (!source) return null;
    return source.toLowerCase().includes('beaumont') ? 'beaumont' : 'conches';
  }, [selectedRestaurant, profile?.preferred_restaurant]);

  // Lookup existing conversation for current user (do NOT create).
  const lookupConversation = useCallback(async () => {
    if (!user) return null;

    const site = resolveSite();
    if (!site) return null;

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
    return null;
  }, [user, resolveSite]);

  // Create the conversation on demand (first customer message).
  const createConversation = useCallback(async () => {
    if (!user) return null;
    const site = resolveSite();
    if (!site) return null;

    const customerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Client';
    const { data: newConv, error } = await supabase
      .from('chat_conversations')
      .insert({
        customer_id: user.id,
        site,
        customer_name: customerName,
        customer_phone: profile?.phone,
      })
      .select()
      .single();

    if (newConv && !error) {
      setConversationId(newConv.id);
      return newConv.id;
    }
    return null;
  }, [user, profile, resolveSite]);


  // Fetch messages
  const fetchMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as ChatMessage[]);
      // Mark any admin messages as delivered to this customer device.
      const toDeliver = (data as ChatMessage[])
        .filter(m => m.sender_type === 'admin' && !m.delivered_at)
        .map(m => m.id);
      if (toDeliver.length > 0) {
        const nowIso = new Date().toISOString();
        setMessages(prev =>
          prev.map(m => (toDeliver.includes(m.id) ? { ...m, delivered_at: nowIso } : m))
        );
        await supabase
          .from('chat_messages')
          .update({ delivered_at: nowIso })
          .in('id', toDeliver)
          .is('delivered_at', null);
      }
    }
  }, []);

  // Mark admin messages in the current conversation as read (customer is the reader)
  const markMessagesRead = useCallback(async () => {
    if (!conversationId) return;
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'admin')
      .is('read_at', null);
  }, [conversationId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user) return;

    const site = resolveSite();
    if (!site) return;

    let convId = conversationId;
    if (!convId) {
      convId = await lookupConversation();
    }
    if (!convId) {
      convId = await createConversation();
    }
    if (!convId) return;

    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_type: 'customer',
      content,
      site,
    });

    // Update conversation (and un-hide it for admin so the reply is visible again)
    await supabase
      .from('chat_conversations')
      .update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        hidden_for_admin_at: null,
      })
      .eq('id', convId);
  }, [user, conversationId, lookupConversation, createConversation, resolveSite]);

  // Init & realtime
  useEffect(() => {
    if (!user || !resolveSite()) {
      setLoading(false);
      return;
    }

    // Reset current conversation when the active site changes.
    setConversationId(null);
    setMessages([]);

    const init = async () => {
      const convId = await lookupConversation();
      if (convId) {
        await fetchMessages(convId);
      }
      setLoading(false);
    };
    init();

    // Detect admin-created conversation in realtime (case where the restaurant
    // sends the very first message before the customer has one).
    if (!user) return;
    const initChannel = supabase
      .channel(`customer-chat-lookup-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
          filter: `customer_id=eq.${user.id}`,
        },
        async (payload) => {
          const conv = payload.new as { id: string; site: string };
          const site = resolveSite();
          if (site && conv.site === site) {
            setConversationId(conv.id);
            await fetchMessages(conv.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(initChannel);
    };
  }, [user, resolveSite, lookupConversation, fetchMessages]);


  // Realtime subscription based on conversationId
  useEffect(() => {
    if (!conversationId) return;

    // Ask for browser push permission so we can notify on admin replies
    requestNotificationPermission();

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

          // Notify only when the restaurant (admin) replies
          if (msg.sender_type === 'admin') {
            // Mark as delivered to this customer device immediately
            if (!msg.delivered_at) {
              const nowIso = new Date().toISOString();
              setMessages(prev =>
                prev.map(m => (m.id === msg.id ? { ...m, delivered_at: nowIso } : m))
              );
              supabase
                .from('chat_messages')
                .update({ delivered_at: nowIso })
                .eq('id', msg.id)
                .is('delivered_at', null)
                .then(() => {});
            }
            try { playChatSound(); } catch {}
            try {
              showWebNotification('Nouveau message', msg.content, msg.id);
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev =>
            prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      )
      .subscribe((status) => {
        // On (re)connection, refetch to catch any read_at / new messages
        // that arrived while the socket was down.
        if (status === 'SUBSCRIBED') {
          fetchMessages(conversationId);
        }
      });

    channelRef.current = channel;

    // Refetch on tab focus / network recovery so "Envoyé" flips to "Lu" even
    // if a realtime UPDATE was missed while the tab was backgrounded.
    const handleVisible = () => {
      if (document.visibilityState === 'visible') fetchMessages(conversationId);
    };
    const handleOnline = () => fetchMessages(conversationId);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('online', handleOnline);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('online', handleOnline);
    };
  }, [conversationId, fetchMessages]);

  return { messages, loading, sendMessage, markMessagesRead, conversationId, site: resolveSite() };
}
