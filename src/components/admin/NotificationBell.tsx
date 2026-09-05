import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShoppingBag, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const navigate = useNavigate();
  const isOrder =
    notification.type === 'new_order' || notification.type === 'invoice_request';

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }
    navigate(isOrder ? '/admin/orders' : '/admin/chat');
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/50 transition-colors flex gap-3 items-start ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
        isOrder ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
      }`}>
        {isOrder ? <ShoppingBag className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {notification.body}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
            {notification.site}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aucune notification
            </div>
          ) : (
            notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onRead={markAsRead}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
