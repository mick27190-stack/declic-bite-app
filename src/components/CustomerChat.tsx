import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, X, LogIn, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomerChat } from '@/hooks/useCustomerChat';
import { useAdminPresenceWatch } from '@/hooks/useAdminPresence';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';

function MessageBubble({ message }: { message: { sender_type: string; content: string; created_at: string } }) {
  const isCustomer = message.sender_type === 'customer';
  return (
    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isCustomer
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        <p className={`text-[10px] mt-1 ${isCustomer ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          {new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function CustomerChat() {
  const { user, profile } = useAuth();
  const { selectedRestaurant } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendMessage } = useCustomerChat();
  const { isOnline } = useAdminPresenceWatch();

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const wasOpenRef = useRef(false);

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
  }, [getViewport, open, loading]);

  // Snap to bottom when the panel opens or finishes loading
  useEffect(() => {
    if (open && !loading && !wasOpenRef.current) {
      wasOpenRef.current = true;
      prevCountRef.current = messages.length;
      scrollToBottom();
    }
    if (!open) wasOpenRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

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
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    forceScrollRef.current = true;
    scrollToBottom('smooth');
    await sendMessage(msg);
  };

  const needsRestaurant = user && profile && !selectedRestaurant && !profile.preferred_restaurant;

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Ouvrir le chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[70vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <div>
                <span className="font-semibold text-sm">Chat Déclic Pizza</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-primary-foreground/40'}`} />
                  <span className="text-[10px] text-primary-foreground/80">
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
              <LogIn className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connectez-vous pour discuter avec nous</p>
              <Button onClick={() => navigate('/auth')} size="sm">
                Se connecter
              </Button>
            </div>
          ) : needsRestaurant ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Veuillez d'abord sélectionner votre restaurant dans votre profil pour démarrer une conversation.
              </p>
              <Button onClick={() => navigate('/profile')} size="sm">
                Mon profil
              </Button>
            </div>
          ) : (
            <>
              <div className="relative flex-1 min-h-0">
                <ScrollArea className="h-full p-4 min-h-[250px] max-h-[50vh]" ref={scrollRef}>
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center">
                        Envoyez-nous un message, nous vous répondrons au plus vite !
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                      ))}
                    </div>
                  )}
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


              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Votre message..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="text-sm"
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
