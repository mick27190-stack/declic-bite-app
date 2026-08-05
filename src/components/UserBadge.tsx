import { User, Shield, Bike } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UserBadgeVariant = 'account' | 'admin' | 'livreur';

interface UserBadgeProps {
  variant: UserBadgeVariant;
  label: string;
  onClick?: () => void;
  className?: string;
}

const baseClasses = 'flex items-center gap-1 px-3 py-1 text-sm shadow-lg';

export function UserBadge({ variant, label, onClick, className }: UserBadgeProps) {
  if (variant === 'account') {
    return (
      <Button
        variant="glass"
        size="sm"
        onClick={onClick}
        className={cn(
          'h-auto gap-1.5 px-3 py-1 text-sm font-semibold leading-none',
          className
        )}
      >
        <User className="w-4 h-4" />
        <span>{label}</span>
      </Button>
    );
  }

  if (variant === 'admin') {
    return (
      <Badge className={cn(baseClasses, 'bg-primary hover:bg-primary text-primary-foreground', className)}>
        <Shield className="w-4 h-4" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge className={cn(baseClasses, 'bg-amber-500 hover:bg-amber-500 text-white', className)}>
      <Bike className="w-4 h-4" />
      {label}
    </Badge>
  );
}
