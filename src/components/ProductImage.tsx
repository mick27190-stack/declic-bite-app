import { useState } from 'react';
import { Pizza as PizzaIcon } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Affiche la photo d'un produit, ou une icône par défaut
 * lorsqu'aucune photo n'a été ajoutée (ou en cas d'erreur de chargement).
 */
export function ProductImage({ src, alt, className = '', iconClassName = 'h-1/3 w-1/3' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src) && src !== '/placeholder.svg' && !failed;

  if (!hasImage) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-muted ${className}`}
      >
        <PizzaIcon className={`text-muted-foreground ${iconClassName}`} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img src={src as string} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}
