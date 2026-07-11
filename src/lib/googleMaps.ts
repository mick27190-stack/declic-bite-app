import { importLibrary, setOptions, type LibraryMap } from '@googlemaps/js-api-loader';

let optionsConfigured = false;

export function configureGoogleMaps() {
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  if (!apiKey) {
    throw new Error('Clé Google Maps non configurée');
  }

  if (!optionsConfigured) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      channel,
    });
    optionsConfigured = true;
  }
}

export async function loadGoogleMapsLibrary<TLibraryName extends keyof LibraryMap>(
  libraryName: TLibraryName
) {
  configureGoogleMaps();
  return importLibrary(libraryName);
}