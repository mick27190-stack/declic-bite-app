import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryZoneResult {
  isInZone: boolean;
  distanceKm: number | null;
  distanceText?: string;
  durationText?: string;
  addressFormatted?: string;
  coordinates?: { lat: number; lng: number };
  postalCode?: string | null;
  error?: string;
}

export function useDeliveryZone() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DeliveryZoneResult | null>(null);

  const checkDeliveryZone = useCallback(async (
    address: string,
    restaurantId: 'conches' | 'beaumont'
  ): Promise<DeliveryZoneResult> => {
    setIsChecking(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('check-delivery-zone', {
        body: { address, restaurantId }
      });

      if (error) {
        console.error('Error checking delivery zone:', error);
        const errorResult: DeliveryZoneResult = {
          isInZone: false,
          distanceKm: null,
          error: 'Erreur lors de la vérification'
        };
        setResult(errorResult);
        return errorResult;
      }

      setResult(data);
      return data;
    } catch (err) {
      console.error('Error checking delivery zone:', err);
      const errorResult: DeliveryZoneResult = {
        isInZone: false,
        distanceKm: null,
        error: 'Erreur de connexion'
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    checkDeliveryZone,
    isChecking,
    result,
    clearResult
  };
}
