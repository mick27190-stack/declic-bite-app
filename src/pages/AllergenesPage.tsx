import { LegalLayout, LegalP } from '@/components/LegalLayout';

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
    </LegalLayout>
  );
}
