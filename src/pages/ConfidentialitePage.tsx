import { LegalLayout, LegalH2, LegalP, LegalList, LegalTable } from '@/components/LegalLayout';

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      intro={
        <>
          <p>Site : declicpizza.fr — Déclic Pizza (Conches &amp; Beaumont)</p>
          <p>Dernière mise à jour : 26/08/2026</p>
        </>
      }
    >
      <LegalH2>1. Responsables de traitement</LegalH2>
      <LegalP>
        Le site declicpizza.fr est co-géré par deux exploitants indépendants, chacun
        responsable du traitement des données liées aux commandes passées auprès de
        son établissement :
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">Déclic Pizza Conches</strong> —
        Thierry DUPONT, Entrepreneur individuel
        <br />
        SIREN 452 109 002 — 1 Place Carnot, 27190 Conches-en-Ouche
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">Déclic Pizza Beaumont</strong> —
        Flora DUPONT, Entrepreneur individuel
        <br />
        SIREN 505 301 192 — 66 Rue Saint Nicolas, 27170 Beaumont-le-Roger
      </LegalP>
      <LegalP>
        Contact commun pour toute question relative aux données personnelles :{' '}
        <a
          href="mailto:declicpizza@gmail.com"
          className="text-primary underline hover:text-primary/80"
        >
          declicpizza@gmail.com
        </a>
      </LegalP>

      <LegalH2>2. Données collectées</LegalH2>
      <LegalTable
        headers={['Catégorie', 'Exemples', 'Finalité']}
        rows={[
          [
            'Identité et contact',
            'Nom, prénom, téléphone, e-mail',
            'Gestion de la commande, contact client',
          ],
          [
            'Adresse',
            'Adresse de livraison',
            'Livraison des commandes',
          ],
          [
            'Commande',
            'Produits commandés, montant, historique',
            'Traitement, suivi, statistiques',
          ],
          [
            'Paiement',
            'Données de carte bancaire',
            'Traitées exclusivement par Stripe ; les exploitants n'ont jamais accès au numéro de carte complet',
          ],
          [
            'Communication marketing',
            'Numéro de téléphone (SMS), consentement, préférences',
            'Envoi de campagnes SMS promotionnelles, uniquement avec consentement préalable (opt-in)',
          ],
          [
            'Navigation',
            'Cookies techniques et de mesure d'audience',
            'Fonctionnement du Site, statistiques de fréquentation',
          ],
        ]}
      />

      <LegalH2>3. Base légale des traitements</LegalH2>
      <LegalList
        items={[
          <>
            <strong className="font-semibold text-foreground">Exécution du contrat :</strong>{' '}
            traitement de la commande, paiement, livraison (art. 6.1.b RGPD).
          </>,
          <>
            <strong className="font-semibold text-foreground">Consentement :</strong>{' '}
            envoi de SMS promotionnels (art. 6.1.a RGPD) — inscription volontaire
            (opt-in), désinscription possible à tout moment en répondant STOP.
            Consentement également requis pour les cookies de mesure d'audience (voir
            Article 7).
          </>,
          <>
            <strong className="font-semibold text-foreground">Intérêt légitime :</strong>{' '}
            amélioration du service, prévention de la fraude.
          </>,
          <>
            <strong className="font-semibold text-foreground">Obligation légale :</strong>{' '}
            conservation des factures et données comptables conformément aux
            obligations fiscales françaises.
          </>,
        ]}
      />

      <LegalH2>4. Destinataires et sous-traitants</LegalH2>
      <LegalTable
        headers={['Sous-traitant', 'Rôle', 'Localisation']}
        rows={[
          [
            'Stripe (Stripe Payments Europe, Ltd.)',
            'Traitement des paiements — un compte distinct par établissement',
            'Irlande (UE)',
          ],
          [
            'Supabase (Supabase Pte. Ltd.)',
            'Hébergement de la base de données et des fonctions back-end',
            'Société basée à Singapour ; projet de base de données configuré en région UE',
          ],
          [
            'Twilio (Twilio Ireland Limited)',
            'Envoi des SMS promotionnels et transactionnels',
            'Irlande (UE)',
          ],
          [
            'Google Analytics (Google Ireland Limited)',
            'Mesure d'audience du Site',
            'Traitement susceptible d'impliquer un transfert vers les États-Unis',
          ],
          [
            'IONOS (IONOS SARL)',
            'Hébergement technique du Site',
            'Sarreguemines, France (UE)',
          ],
          [
            'Lovable',
            'Plateforme de développement du Site (analytique intégrée)',
            'À vérifier — société basée hors UE',
          ],
        ]}
      />
      <LegalP>
        Le personnel de l'établissement Conches ou Beaumont concerné a également
        accès aux données de commande pour la préparation et la livraison.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">Transferts hors UE :</strong>{' '}
        bien que la base de données Supabase soit hébergée en région UE, l'éditeur du
        service (Supabase Pte. Ltd.) est une société basée à Singapour, et Google
        Analytics comme Lovable peuvent impliquer des traitements hors UE. Ces
        transferts, lorsqu'ils existent, sont encadrés par les garanties prévues par
        ces prestataires (clauses contractuelles types de la Commission européenne ou
        mécanisme équivalent). Aucune donnée n'est vendue à des tiers.
      </LegalP>

      <LegalH2>5. Durée de conservation</LegalH2>
      <LegalList
        items={[
          <>
            <strong className="font-semibold text-foreground">Données de commande et de facturation :</strong>{' '}
            10 ans (obligation légale comptable).
          </>,
          <>
            <strong className="font-semibold text-foreground">Données de compte client actif :</strong>{' '}
            durée de la relation commerciale + 3 ans après la dernière commande
            (prospection).
          </>,
          <>
            <strong className="font-semibold text-foreground">Consentement SMS marketing :</strong>{' '}
            conservé jusqu'au retrait du consentement (STOP) ou 3 ans d'inactivité.
          </>,
          <>
            <strong className="font-semibold text-foreground">Données de paiement :</strong>{' '}
            non conservées par les exploitants (gérées par Stripe selon sa propre
            politique).
          </>,
          <>
            <strong className="font-semibold text-foreground">Cookies de mesure d'audience :</strong>{' '}
            durée de vie maximale de 13 mois, conformément aux recommandations de la
            CNIL.
          </>,
        ]}
      />

      <LegalH2>6. Sécurité</LegalH2>
      <LegalP>
        Les exploitants mettent en œuvre les mesures techniques et organisationnelles
        appropriées pour protéger les données (hébergement sécurisé, chiffrement des
        échanges, accès restreint au back-office, paiement délégué à un prestataire
        certifié PCI-DSS).
      </LegalP>

      <LegalH2>7. Cookies</LegalH2>
      <LegalP>Le Site utilise :</LegalP>
      <LegalList
        items={[
          <>
            des cookies strictement nécessaires à son fonctionnement (panier, session
            de commande), exemptés de consentement ;
          </>,
          <>
            des cookies de mesure d'audience via Google Analytics et l'analytique
            intégrée à Lovable, qui nécessitent le consentement préalable du Client
            conformément aux recommandations de la CNIL.
          </>,
        ]}
      />
      <LegalP>
        Un bandeau de consentement doit permettre au Client d'accepter ou de refuser
        les cookies non essentiels avant tout dépôt, et de modifier son choix à tout
        moment via un lien dédié en pied de page.
      </LegalP>

      <LegalH2>8. Droits des personnes</LegalH2>
      <LegalP>
        Conformément au RGPD et à la loi Informatique et Libertés, toute personne
        dispose des droits suivants :
      </LegalP>
      <LegalList
        items={[
          'Droit d'accès',
          'Droit de rectification',
          'Droit à l'effacement',
          'Droit à la limitation du traitement',
          'Droit à la portabilité',
          'Droit d'opposition (notamment à la prospection commerciale, y compris SMS)',
          'Droit de définir des directives relatives au sort de ses données après son décès',
        ]}
      />
      <LegalP>
        Ces droits peuvent être exercés en écrivant à{' '}
        <a
          href="mailto:declicpizza@gmail.com"
          className="text-primary underline hover:text-primary/80"
        >
          declicpizza@gmail.com
        </a>
        , en précisant l'établissement concerné (Conches ou Beaumont) si la demande
        porte sur une commande spécifique, et en joignant un justificatif d'identité si
        nécessaire.
      </LegalP>
      <LegalP>
        En cas de désinscription des SMS promotionnels, il suffit de répondre STOP au
        message reçu.
      </LegalP>

      <LegalH2>9. Réclamation auprès de la CNIL</LegalH2>
      <LegalP>
        En cas de difficulté persistante, toute personne peut introduire une
        réclamation auprès de la Commission Nationale de l'Informatique et des
        Libertés (CNIL) :
        <br />
        3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 —{' '}
        <a
          href="https://www.cnil.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          www.cnil.fr
        </a>
      </LegalP>

      <LegalH2>10. Envoi de SMS promotionnels — conformité spécifique</LegalH2>
      <LegalP>Les campagnes SMS respectent :</LegalP>
      <LegalList
        items={[
          'le recueil préalable du consentement exprès du destinataire (opt-in), aucune case pré-cochée ;',
          'la mention claire de l'identité de l'expéditeur (Déclic Pizza) ;',
          'une possibilité de désinscription simple et gratuite (STOP) à chaque envoi ;',
          'le respect des plages horaires autorisées pour la prospection commerciale par SMS en France.',
        ]}
      />

      <LegalH2>11. Modification de la présente politique</LegalH2>
      <LegalP>
        La version en vigueur est celle publiée sur le Site à la date de consultation.
      </LegalP>
    </LegalLayout>
  );
}
