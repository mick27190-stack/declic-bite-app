import { LegalLayout, LegalP } from '@/components/LegalLayout';
import { restaurants } from '@/data/pizzas';

export default function AllergenesPage() {
  return (
    <LegalLayout title="Allergènes">
      <LegalP>
        Conformément à la réglementation, nous vous informons de la présence possible des allergènes suivants dans nos préparations : gluten, crustacés, œufs, poissons, arachides, soja, lait et produits laitiers, fruits à coque, céleri, moutarde, graines de sésame, sulfites, lupin, mollusques.
      </LegalP>
      <LegalP>
        La composition détaillée de chaque pizza est indiquée sur sa fiche produit. En cas d'allergie ou d'intolérance, merci de nous contacter avant de commander :{' '}
        <a href="mailto:declicpizza@gmail.com" className="text-primary underline">declicpizza@gmail.com</a>.
      </LegalP>
      <LegalP>
        Vous pouvez également joindre directement l'un de nos établissements :
        <ul className="mt-2 space-y-1">
          {restaurants.map((r) => (
            <li key={r.id}>
              <strong>{r.name}</strong> —{' '}
              <a href={`tel:${r.phone.replace(/\./g, '')}`} className="text-primary underline">
                {r.phone}
              </a>
            </li>
          ))}
        </ul>
      </LegalP>
    </LegalLayout>
  );
}

