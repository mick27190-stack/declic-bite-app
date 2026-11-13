interface AddressComponent {
  long_name?: string;
  types?: string[];
}

// Use Google's structured components, not words in the address: "Hameau"
// can be part of a real street name. A lieu-dit alone lacks a numbered route.
export function hasCompleteStreetAddress(components: AddressComponent[] = []): boolean {
  const hasComponent = (type: string) => components.some(
    (component) => component.types?.includes(type) && Boolean(component.long_name?.trim()),
  );
  return hasComponent('street_number') && hasComponent('route');
}