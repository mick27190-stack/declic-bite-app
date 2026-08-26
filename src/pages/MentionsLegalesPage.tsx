import { LegalLayout, LegalH2, LegalP, LegalEntity, LegalList } from '@/components/LegalLayout';

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions légales"
      intro={
        <>
          <p>Site : declicpizza.fr</p>
          <p>Dernière mise à jour : 26/08/2026</p>
        </>
      }
    >
      <LegalH2>1. Éditeurs du site</LegalH2>
      <LegalP>
        Le site declicpizza.fr est édité conjointement par les deux exploitants
        suivants, chacun responsable de son propre établissement et de ses propres
        ventes :
      </LegalP>

      <LegalEntity
        name="Déclic Pizza Conches"
        lines={[
          'Thierry DUPONT, Entrepreneur individuel (artisan)',
          'SIREN : 452 109 002 — SIRET : 452 109 002 00033',
          'Code APE : 5610C — Restauration de type rapide',
          'Adresse : 1 Place Carnot, 27190 Conches-en-Ouche',
          'Téléphone : 02 32 38 41 77',
        ]}
      />

      <LegalEntity
        name="Déclic Pizza Beaumont"
        lines={[
          'Flora DUPONT, Entrepreneur individuel',
          'SIREN : 505 301 192 — SIRET : 505 301 192 00033',
          'Code APE : 5610C — Restauration de type rapide',
          'Adresse : 66 Rue Saint Nicolas, 27170 Beaumont-le-Roger',
          'Téléphone : 02 27 19 74 52',
        ]}
      />

      <LegalP>
        Les deux exploitants bénéficient de la franchise en base de TVA : TVA non
        applicable, article 293 B du Code général des impôts.
      </LegalP>
      <LegalP>
        Contact commun / directeurs de la publication : Thierry Dupont et Flora
        Dupont —{' '}
        <a
          href="mailto:declicpizza@gmail.com"
          className="text-primary underline hover:text-primary/80"
        >
          declicpizza@gmail.com
        </a>
      </LegalP>

      <LegalH2>2. Hébergement</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">Hébergeur du site (front-end) :</strong>
        <br />
        IONOS SARL
        <br />
        Société à responsabilité limitée au capital de 100 000 €
        <br />
        Siège social : 7 Place de la Gare, 57200 Sarreguemines
        <br />
        RCS Sarreguemines 431 303 775
      </LegalP>

      <LegalP>
        <strong className="font-semibold text-foreground">Hébergeur de la base de données et des fonctions serveur :</strong>
        <br />
        Supabase Pte. Ltd.
        <br />
        65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513
        <br />
        Projet de base de données configuré en région Union européenne.
      </LegalP>

      <LegalP>
        <strong className="font-semibold text-foreground">Prestataire de paiement :</strong>
        <br />
        Stripe Payments Europe, Ltd.
        <br />
        1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande
      </LegalP>

      <LegalP>
        <strong className="font-semibold text-foreground">Prestataire d'envoi de SMS :</strong>
        <br />
        Twilio Ireland Limited
        <br />
        25-28 North Wall Quay, Dublin 1, Irlande
      </LegalP>

      <LegalH2>3. Propriété intellectuelle</LegalH2>
      <LegalP>
        L'ensemble des éléments présents sur le Site (textes, images, logos, charte
        graphique, la marque et le nom commercial « Déclic Pizza », icônes, structure
        du site) sont protégés par le droit d'auteur, le droit des marques et, plus
        généralement, par le droit de la propriété intellectuelle. Toute reproduction,
        représentation, modification, publication ou adaptation, totale ou partielle,
        sans autorisation préalable écrite, est interdite.
      </LegalP>

      <LegalH2>4. Données personnelles</LegalH2>
      <LegalP>
        Le traitement des données personnelles collectées via le Site est décrit dans
        la Politique de Confidentialité / RGPD. Toute personne dispose d'un droit
        d'accès, de rectification, d'effacement et d'opposition sur ses données,
        exerçable à l'adresse{' '}
        <a
          href="mailto:declicpizza@gmail.com"
          className="text-primary underline hover:text-primary/80"
        >
          declicpizza@gmail.com
        </a>
        .
      </LegalP>

      <LegalH2>5. Cookies</LegalH2>
      <LegalP>
        Le Site utilise des cookies techniques nécessaires à son fonctionnement ainsi
        que des cookies de mesure d'audience (Google Analytics, analytique Lovable),
        soumis au consentement préalable du visiteur. Pour plus de détails, se référer
        à la section « Cookies » de la Politique de Confidentialité.
      </LegalP>

      <LegalH2>6. Limitation de responsabilité</LegalH2>
      <LegalP>
        Les éditeurs s'efforcent d'assurer l'exactitude et la mise à jour des
        informations diffusées sur le Site, mais ne sauraient garantir l'absence
        d'erreur ou d'omission. Ils ne pourront être tenus responsables des dommages
        directs ou indirects résultant de l'accès ou de l'utilisation du Site, y
        compris en cas d'interruption temporaire pour maintenance.
      </LegalP>

      <LegalH2>7. Liens hypertextes</LegalH2>
      <LegalP>
        Le Site peut contenir des liens vers d'autres sites. Les éditeurs n'exercent
        aucun contrôle sur ces sites tiers et déclinent toute responsabilité quant à
        leur contenu.
      </LegalP>

      <LegalH2>8. Droit applicable</LegalH2>
      <LegalP>
        Les présentes mentions légales sont soumises au droit français. Tout litige
        relatif à l'utilisation du Site relève de la compétence des tribunaux
        français.
      </LegalP>

      <LegalH2>9. Médiation de la consommation</LegalH2>
      <LegalP>
        Conformément aux articles L616-1 et R616-1 du Code de la consommation, tout
        client consommateur a le droit de recourir gratuitement à un médiateur de la
        consommation en cas de litige non résolu. Médiateur en cours de désignation —
        coordonnées à venir.
      </LegalP>
    </LegalLayout>
  );
}
