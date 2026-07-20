import { useState, useEffect, useCallback, useRef } from 'react';
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
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'customer' | 'admin';
  content: string;
  site: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export function useChat(siteFilter?: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    selectedIdRef.current = selectedConversationId;
  }, [selectedConversationId]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      const local = new Map(prev.map(m => [m.id, m]));
      return incoming.map(msg => {
        const current = local.get(msg.id);
        if (!current) return msg;
        return {
          ...msg,
          delivered_at: msg.delivered_at ?? current.delivered_at,
          read_at: msg.read_at ?? current.read_at,
        };
      });
    });
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .is('hidden_for_admin_at', null)
      .order('last_message_at', { ascending: false });

    if (siteFilter && siteFilter !== 'all') {
      query = query.eq('site', siteFilter);
    }

    const { data } = await query;
    if (data) {
      // Load unread customer messages to compute per-conversation counts
      const { data: unread } = await supabase
        .from('chat_messages')
        .select('conversation_id')
        .is('read_at', null)
        .eq('sender_type', 'customer');

      const counts = new Map<string, number>();
      (unread ?? []).forEach((m: { conversation_id: string }) => {
        counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
      });

      setConversations(
        (data as ChatConversation[])
          .filter(c => !!c.last_message_at)
          .map(c => ({
            ...c,
            unread_count: c.id === selectedIdRef.current ? 0 : (counts.get(c.id) ?? 0),
          }))
      );
    }
    setLoading(false);
  }, [siteFilter]);

  // Background recount used after reconnect / visibility / online events.
  // Shows a lightweight loading indicator without the full skeleton state.
  const refreshConversations = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchConversations();
    } finally {
      setRefreshing(false);
    }
  }, [fetchConversations]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      mergeMessages(data as ChatMessage[]);
      // Any customer message loaded here has now been delivered to this admin device.
      const toDeliver = (data as ChatMessage[])
        .filter(m => m.sender_type === 'customer' && !m.delivered_at)
        .map(m => m.id);
      if (toDeliver.length > 0) {
        markDeliveredRef.current?.(toDeliver);
      }
    }
  }, [mergeMessages]);

  // Mark specific messages as delivered (received on this admin device).
  const markDeliveredRef = useRef<((ids: string[]) => Promise<void>) | null>(null);
  const markDelivered = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const nowIso = new Date().toISOString();
    setMessages(prev =>
      prev.map(m => (ids.includes(m.id) && !m.delivered_at ? { ...m, delivered_at: nowIso } : m))
    );
    const { data } = await supabase
      .from('chat_messages')
      .update({ delivered_at: nowIso })
      .in('id', ids)
      .is('delivered_at', null)
      .select('*');
    if (data) {
      const updated = data as ChatMessage[];
      setMessages(prev => prev.map(m => updated.find(u => u.id === m.id) ?? m));
    }
  }, []);
  useEffect(() => { markDeliveredRef.current = markDelivered; }, [markDelivered]);

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

  // Mark customer messages in a conversation as read (admin is the reader).
  // Optimistic UI + server persistence with rollback on failure so badges
  // stay correct after a refresh or reconnect.
  const markMessagesRead = useCallback(async (conversationId: string) => {
    const nowIso = new Date().toISOString();

    // Snapshot for rollback if the server update fails.
    let previousMessages: ChatMessage[] = [];
    let previousUnread = 0;
    setMessages(prev => {
      previousMessages = prev;
      return prev.map(m =>
        m.conversation_id === conversationId &&
        m.sender_type === 'customer' &&
        !m.read_at
          ? { ...m, delivered_at: m.delivered_at ?? nowIso, read_at: nowIso }
          : m
      );
    });
    setConversations(prev => {
      const current = prev.find(c => c.id === conversationId);
      previousUnread = current?.unread_count ?? 0;
      return prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c));
    });

    const { data, error } = await supabase
      .from('chat_messages')
      .update({ delivered_at: nowIso, read_at: nowIso })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'customer')
      .is('read_at', null)
      .select('*');

    if (error) {
      console.error('markMessagesRead failed, rolling back:', error);
      setMessages(previousMessages);
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, unread_count: previousUnread } : c))
      );
      return;
    }

    // Reconcile with the persisted values returned by the server so a later
    // refresh or realtime reconnect keeps the exact same state.
    if (data && data.length > 0) {
      const updated = data as ChatMessage[];
      setMessages(prev =>
        prev.map(m => updated.find(u => u.id === m.id) ?? m)
      );
    }
  }, []);

  const markConversationNotificationsRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', 'new_message')
      .eq('reference_id', conversationId)
      .eq('is_read', false);
  }, [user]);

  // Select conversation
  const selectConversation = useCallback((id: string) => {
    // Update the ref synchronously so any fetchConversations() called by
    // realtime/reconnect right after selection already forces unread=0 here.
    selectedIdRef.current = id;
    setSelectedConversationId(id);
    // Optimistic: clear the badge for this conversation right away.
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, unread_count: 0 } : c))
    );
    fetchMessages(id);
    markMessagesRead(id);
    markConversationNotificationsRead(id);
  }, [fetchMessages, markMessagesRead, markConversationNotificationsRead]);


  // Hide conversation from admin view (does NOT delete messages, client keeps history)
  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ hidden_for_admin_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== id));
      setSelectedConversationId(prev => (prev === id ? null : prev));
      setMessages(prev => (selectedConversationId === id ? [] : prev));
    }
    return { error };
  }, [selectedConversationId]);



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
          const activeId = selectedIdRef.current;
          // Any incoming customer message is now delivered to this admin device
          if (newMsg.sender_type === 'customer' && !newMsg.delivered_at) {
            markDelivered([newMsg.id]);
          }
          // Add to current messages if viewing this conversation
          if (newMsg.conversation_id === activeId) {
            setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
            // A new customer message arrived while viewing → mark as read
            if (newMsg.sender_type === 'customer') {
              markMessagesRead(activeId);
            }
          } else if (newMsg.sender_type === 'customer') {
            // Unread count / conversation list needs refresh
            fetchConversations();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          if (updated.conversation_id === selectedIdRef.current) {
            setMessages(prev =>
              prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
            );
          }
          // read_at updates may change unread counts
          fetchConversations();
        }
      )
      .subscribe((status) => {
        // On any successful (re)connection, force a full recount from the
        // server so badges match the persisted read_at values.
        if (status === 'SUBSCRIBED') {
          refreshConversations();
          const currentId = selectedIdRef.current;
          if (currentId) {
            fetchMessages(currentId);
          }
        }
        // Realtime dropped / errored → resync immediately so Envoyé/Reçu/Lu
        // don't stay stale until the next visibility or interval tick.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          refreshConversations();
          const currentId = selectedIdRef.current;
          if (currentId) fetchMessages(currentId);
        }
      });


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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refreshConversations();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          refreshConversations();
        }
      });

    // Ref-indirected kick so visibility/online handlers can also reset the
    // adaptive scheduler (defined below) back to its base interval.
    const kickResyncRef: { current: () => void } = { current: () => {} };

    // Also refresh when the browser tab becomes visible again or the
    // network comes back online — realtime may have missed events while
    // the socket was down.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshConversations();
        const currentId = selectedIdRef.current;
        if (currentId) fetchMessages(currentId);
        kickResyncRef.current();
      }
    };
    const handleOnline = () => {
      refreshConversations();
      const currentId = selectedIdRef.current;
      if (currentId) fetchMessages(currentId);
      kickResyncRef.current();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);


    // Adaptive safety-net resync with exponential backoff.
    // - Base 15s, doubles up to 5min when nothing changes.
    // - Resets to base whenever the fetched snapshot differs.
    // - Pauses entirely when everything is fully in sync (no unread badge
    //   and no message pending a read receipt). Wakes back up on realtime
    //   events, tab focus or network recovery via kickResync().
    const BASE_DELAY = 15000;
    const MAX_DELAY = 300000;
    let currentDelay = BASE_DELAY;
    let lastSnapshot = '';
    let timerId: number | null = null;
    let stopped = false;

    const snapshot = () => {
      const convPart = conversationsRef.current
        .map(c => `${c.id}:${c.unread_count ?? 0}:${c.last_message_at ?? ''}`)
        .join('|');
      const msgPart = messagesRef.current
        .map(m => `${m.id}:${m.delivered_at ?? ''}:${m.read_at ?? ''}`)
        .join('|');
      return `${convPart}#${msgPart}`;
    };

    const fullySynced = () => {
      const anyUnread = conversationsRef.current.some(c => (c.unread_count ?? 0) > 0);
      // Any message still awaiting a read receipt keeps polling alive.
      const pending = messagesRef.current.some(m => !m.read_at);
      return !anyUnread && !pending;
    };

    const scheduleNext = (delay: number) => {
      if (stopped) return;
      if (timerId !== null) window.clearTimeout(timerId);
      timerId = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') {
        // Retry sooner when the tab comes back; don't burn cycles hidden.
        scheduleNext(BASE_DELAY);
        return;
      }
      await refreshConversations();
      const currentId = selectedIdRef.current;
      if (currentId) await fetchMessages(currentId);

      const next = snapshot();
      if (next !== lastSnapshot) {
        lastSnapshot = next;
        currentDelay = BASE_DELAY;
      } else {
        currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
      }

      if (fullySynced()) {
        // Nothing to reconcile — stop the timer until an external event
        // (realtime, visibility, online, new selection) wakes it back up.
        if (timerId !== null) {
          window.clearTimeout(timerId);
          timerId = null;
        }
        return;
      }
      scheduleNext(currentDelay);
    };

    const kickResync = () => {
      currentDelay = BASE_DELAY;
      scheduleNext(0);
    };
    kickResyncRef.current = kickResync;

    // Also wake the scheduler whenever a realtime event refreshes state.
    // (msgChannel/convChannel above already refetch; we just reset backoff.)
    const originalRefresh = refreshConversations;
    // No wrapping needed: realtime handlers already call refreshConversations
    // which mutates state; the snapshot diff on the next tick will reset the
    // delay. But we also kick immediately so we don't wait the current delay.
    void originalRefresh;

    // Start the scheduler.
    scheduleNext(BASE_DELAY);

    return () => {
      stopped = true;
      if (timerId !== null) window.clearTimeout(timerId);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(convChannel);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, fetchConversations, refreshConversations, fetchMessages, markMessagesRead, markDelivered]);

  return {
    conversations,
    messages,
    selectedConversationId,
    loading,
    refreshing,
    selectConversation,
    sendMessage,
    deleteConversation,
    refresh: fetchConversations,
  };
}
