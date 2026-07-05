import { useState, useEffect, useRef } from 'react';
import { Truck, AlertCircle, CheckCircle, Loader2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeliveryZone } from '@/hooks/useDeliveryZone';
import { useCart } from '@/contexts/CartContext';
import { DeliveryZoneMap } from '@/components/DeliveryZoneMap';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

interface DeliveryZoneCheckerProps {
  onValidAddress?: (address: string, coordinates: { lat: number; lng: number }, postalCode?: string | null, city?: string | null) => void;
  disabled?: boolean;
}

export function DeliveryZoneChecker({ onValidAddress, disabled }: DeliveryZoneCheckerProps) {
  const [address, setAddress] = useState('');
  const [showMap, setShowMap] = useState(true);
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const { checkDeliveryZone, isChecking, result, clearResult } = useDeliveryZone();
  const { selectedRestaurant, setDeliveryAddress } = useCart();

  // Reset address/validation whenever the selected site changes so the cart
  // alert and checkout button recompute live (postal code differs per site).
  const lastSiteId = useRef(selectedRestaurant?.id ?? null);
  useEffect(() => {
    if (lastSiteId.current !== (selectedRestaurant?.id ?? null)) {
      lastSiteId.current = selectedRestaurant?.id ?? null;
      setAddress('');
      setCustomerCoords(null);
      setSelectedFromAutocomplete(false);
      setDeliveryAddress(null);
      clearResult();
    }
  }, [selectedRestaurant?.id, setDeliveryAddress, clearResult]);

  const handleCheck = async () => {
    if (!address.trim() || !selectedRestaurant) return;
    
    const checkResult = await checkDeliveryZone(address, selectedRestaurant.id);
    
    if (checkResult.coordinates) {
      setCustomerCoords(checkResult.coordinates);
    }
    
    if (checkResult.isInZone && checkResult.coordinates && onValidAddress) {
      onValidAddress(checkResult.addressFormatted || address, checkResult.coordinates, checkResult.postalCode, checkResult.city);
    }
  };

  const handlePlaceSelect = async (place: { address: string; coordinates: { lat: number; lng: number } }) => {
    setAddress(place.address);
    setCustomerCoords(place.coordinates);
    setSelectedFromAutocomplete(true);
    
    // Auto-check when place is selected from autocomplete
    if (selectedRestaurant) {
      const checkResult = await checkDeliveryZone(place.address, selectedRestaurant.id);
      
      if (checkResult.isInZone && checkResult.coordinates && onValidAddress) {
        onValidAddress(checkResult.addressFormatted || place.address, checkResult.coordinates, checkResult.postalCode, checkResult.city);
      }
    }
  };

  const handleAddressChange = (newAddress: string) => {
    setAddress(newAddress);
    setSelectedFromAutocomplete(false);
    // Editing the address invalidates the previously validated delivery address
    // so the cart minimum alert and checkout button update in real time.
    setDeliveryAddress(null);
    clearResult();
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Truck className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold">Vérifier la zone de livraison</h3>
        </div>
        {selectedRestaurant && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMap(!showMap)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Map className="w-4 h-4 mr-1" />
            {showMap ? 'Masquer' : 'Afficher'} la carte
          </Button>
        )}
      </div>

      {!selectedRestaurant && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Veuillez d'abord sélectionner un restaurant</span>
        </div>
      )}

      {/* Interactive Map */}
      {selectedRestaurant && showMap && (
        <DeliveryZoneMap
          restaurantId={selectedRestaurant.id}
          customerCoordinates={customerCoords}
          className="h-[300px] rounded-lg overflow-hidden border border-border"
        />
      )}

      <div className="flex gap-2">
        <AddressAutocomplete
          value={address}
          onChange={handleAddressChange}
          onPlaceSelect={handlePlaceSelect}
          placeholder="Entrez votre adresse complète"
          disabled={!selectedRestaurant || isChecking}
          className="flex-1"
        />
        <Button
          onClick={handleCheck}
          disabled={!address.trim() || !selectedRestaurant || isChecking}
        >
          {isChecking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Vérifier'
          )}
        </Button>
      </div>

      {selectedFromAutocomplete && !result && !isChecking && (
        <p className="text-xs text-muted-foreground">
          ✨ Adresse sélectionnée - vérification automatique en cours...
        </p>
      )}

      {result && (
        <div className={`p-4 rounded-lg border ${
          result.isInZone 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-start gap-3">
            {result.isInZone ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-semibold ${result.isInZone ? 'text-green-600' : 'text-red-600'}`}>
                {result.isInZone 
                  ? 'Livraison disponible !' 
                  : 'Vous êtes hors zone de livraison'}
              </p>
              {result.error ? (
                <p className="text-sm text-muted-foreground mt-1">{result.error}</p>
              ) : (
                <div className="text-sm text-muted-foreground mt-1 space-y-1">
                  {result.addressFormatted && (
                    <p>{result.addressFormatted}</p>
                  )}
                  {result.distanceKm !== null && (
                    <p>Distance: {result.distanceText || `${result.distanceKm} km`}</p>
                  )}
                  {result.durationText && result.isInZone && (
                    <p>Temps de livraison estimé: {result.durationText}</p>
                  )}
                  {!result.isInZone && result.distanceKm !== null && (
                    <p className="text-xs mt-2">
                      Zone de livraison: 12 km maximum depuis le restaurant
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
