import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, User } from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'customer' | 'admin';
  timestamp: string;
}

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  unread: number;
  messages: ChatMessage[];
  site: 'conches' | 'beaumont';
}

// Mock data
const mockConversations: Conversation[] = [
  {
    id: '1',
    customerName: 'Jean Dupont',
    customerPhone: '+33612345678',
    lastMessage: 'Ma commande est-elle prête ?',
    unread: 2,
    site: 'conches',
    messages: [
      { id: '1', content: 'Bonjour, j\'ai passé une commande il y a 30 min', sender: 'customer', timestamp: new Date(Date.now() - 1800000).toISOString() },
      { id: '2', content: 'Ma commande est-elle prête ?', sender: 'customer', timestamp: new Date(Date.now() - 300000).toISOString() }
    ]
  },
  {
    id: '2',
    customerName: 'Marie Martin',
    customerPhone: '+33698765432',
    lastMessage: 'Merci beaucoup !',
    unread: 0,
    site: 'beaumont',
    messages: [
      { id: '1', content: 'Bonjour, avez-vous des pizzas végétariennes ?', sender: 'customer', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: '2', content: 'Oui, nous avons la Végétarienne avec légumes grillés et la Chèvre miel', sender: 'admin', timestamp: new Date(Date.now() - 7000000).toISOString() },
      { id: '3', content: 'Merci beaucoup !', sender: 'customer', timestamp: new Date(Date.now() - 6800000).toISOString() }
    ]
  }
];

export default function AdminChatPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageChat, isSiteAdminConches, isSiteAdminBeaumont, isSuperAdmin, loading: adminLoading } = useAdmin();
  
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!canManageChat) {
        navigate('/admin');
      }
    }
  }, [user, canManageChat, authLoading, adminLoading]);

  const filteredConversations = conversations.filter(conv => {
    if (isSuperAdmin) return true;
    if (isSiteAdminConches && conv.site === 'conches') return true;
    if (isSiteAdminBeaumont && conv.site === 'beaumont') return true;
    return false;
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'admin',
      timestamp: new Date().toISOString()
    };

    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation.id 
        ? { ...conv, messages: [...conv.messages, message], lastMessage: newMessage }
        : conv
    ));

    setSelectedConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, message]
    } : null);

    setNewMessage('');
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    // Mark as read
    setConversations(prev => prev.map(c => 
      c.id === conv.id ? { ...c, unread: 0 } : c
    ));
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Chat Clients</h1>
            <p className="text-sm text-muted-foreground">Communiquer avec vos clients</p>
          </div>
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
                {filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Aucune conversation
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedConversation?.id === conv.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSelectConversation(conv)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{conv.customerName}</p>
                            <p className="text-xs text-muted-foreground">{conv.customerPhone}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {conv.site}
                          </Badge>
                          {conv.unread > 0 && (
                            <Badge className="bg-primary">{conv.unread}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 truncate">
                        {conv.lastMessage}
                      </p>
                    </div>
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
                      <CardTitle className="text-lg">{selectedConversation.customerName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{selectedConversation.customerPhone}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[500px]">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {selectedConversation.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.sender === 'admin'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.sender === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="border-t p-4 flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tapez votre message..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage}>
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
