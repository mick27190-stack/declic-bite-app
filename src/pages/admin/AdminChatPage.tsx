import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useChat, type ChatConversation, type ChatMessage } from '@/hooks/useChat';
import { useAdminPresenceBroadcast } from '@/hooks/useAdminPresence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, User, ArrowDown, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import NotificationBell from '@/components/admin/NotificationBell';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function ConversationItem({ 
  conversation, 
  isSelected, 
  onSelect,
  onDelete,
}: { 
  conversation: ChatConversation; 
  isSelected: boolean; 
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`p-4 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${
        isSelected ? 'bg-muted' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{conversation.customer_name || 'Client'}</p>
            <p className="text-xs text-muted-foreground">{conversation.customer_phone || ''}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs capitalize">
              {conversation.site}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Supprimer la conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    La conversation sera retirée de votre liste. Le client conservera l'historique
                    complet des messages depuis son profil.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {(conversation.unread_count ?? 0) > 0 && (
            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 text-white">
              Nouveau message
            </Badge>
          )}
        </div>
      </div>
      {conversation.last_message && (
        <p className={`text-sm mt-2 truncate ${(conversation.unread_count ?? 0) > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
          {conversation.last_message}
        </p>
      )}
      {conversation.last_message_at && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: fr })}
        </p>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAdmin = message.sender_type === 'admin';
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-xs mt-1 flex items-center gap-1 ${isAdmin ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
          {new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          {isAdmin ? (
            message.read_at && <span className="font-medium">· Lu</span>
          ) : (
            <span className={`font-medium ${message.read_at ? '' : 'text-amber-500'}`}>
              · {message.read_at ? 'Lu' : 'Non lu'}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export default function AdminChatPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageChat, isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, loading: adminLoading } = useAdmin();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  useAdminPresenceBroadcast();

  // Determine site filter based on admin role
  const siteFilter = isSuperAdmin ? 'all' : isSiteAdminConches ? 'conches' : isSiteAdminBeaumont ? 'beaumont' : 'all';
  const { conversations, messages, selectedConversationId, selectConversation, sendMessage } = useChat(siteFilter);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!canManageChat) navigate('/admin');
    }
  }, [user, canManageChat, authLoading, adminLoading]);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const forceScrollRef = useRef(false);

  const getViewport = useCallback(
    () =>
      scrollRef.current?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]') ?? null,
    []
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      requestAnimationFrame(() => {
        const viewport = getViewport();
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        }
      });
      isAtBottomRef.current = true;
      setIsAtBottom(true);
      setNewCount(0);
    },
    [getViewport]
  );

  // Track scroll position (near-bottom stays synced, reading up does not)
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const handleScroll = () => {
      const distanceToBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const atBottom = distanceToBottom < 80;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) setNewCount(0);
    };
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [getViewport, selectedConversationId]);

  // Reset and snap to bottom when switching conversation
  useEffect(() => {
    prevCountRef.current = messages.length;
    isAtBottomRef.current = true;
    setNewCount(0);
    setIsAtBottom(true);
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  // New messages: follow if near bottom or if I just sent, otherwise show badge
  useEffect(() => {
    const prev = prevCountRef.current;
    const added = messages.length - prev;
    prevCountRef.current = messages.length;
    if (added <= 0) return;

    if (forceScrollRef.current || isAtBottomRef.current) {
      forceScrollRef.current = false;
      scrollToBottom('smooth');
    } else {
      setNewCount((c) => c + added);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const content = newMessage.trim();
    setNewMessage('');
    forceScrollRef.current = true;
    scrollToBottom('smooth');
    await sendMessage(selectedConversation.id, content, selectedConversation.site);
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Chat Clients</h1>
              <p className="text-sm text-muted-foreground">Communiquer avec vos clients</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Conversations list */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Aucune conversation
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={selectedConversationId === conv.id}
                      onSelect={() => selectConversation(conv.id)}
                      onDelete={() => deleteConversation(conv.id)}
                    />
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat window */}
          <Card className="md:col-span-2">
            {selectedConversation ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{selectedConversation.customer_name || 'Client'}</CardTitle>
                      <p className="text-sm text-muted-foreground">{selectedConversation.customer_phone}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[500px]">
                  <div className="relative flex-1 min-h-0">
                    <ScrollArea className="h-full p-4" ref={scrollRef}>
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <MessageBubble key={msg.id} message={msg} />
                        ))}
                      </div>
                    </ScrollArea>

                    {!isAtBottom && messages.length > 0 && (
                      <button
                        onClick={() => scrollToBottom('smooth')}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2 text-xs font-medium hover:scale-105 transition-transform animate-in fade-in slide-in-from-bottom-2"
                      >
                        {newCount > 0 && (
                          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                            {newCount}
                          </span>
                        )}
                        {newCount > 0
                          ? `${newCount} nouveau${newCount > 1 ? 'x' : ''} message${newCount > 1 ? 's' : ''}`
                          : 'Revenir au dernier message'}
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="border-t p-4 flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tapez votre message..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <Button onClick={handleSend}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="h-[500px] flex items-center justify-center text-muted-foreground">
                Sélectionnez une conversation pour commencer
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
