import { LegalLayout, LegalH2, LegalP, LegalEntity, LegalList } from '@/components/LegalLayout';

export default function CGVPage() {
  return (
    <LegalLayout
      title="Conditions générales de vente"
      intro={<p>Déclic Pizza — Dernière mise à jour : 04/09/2026</p>}
    >
      <LegalH2>Article 1 — Objet et identification des vendeurs</LegalH2>
      <LegalP>
        Les présentes Conditions Générales de Vente (« CGV ») régissent les ventes de
        produits alimentaires effectuées via le site declicpizza.fr (« le Site »).
      </LegalP>
      <LegalP>
        Le Site permet de commander auprès de deux établissements, exploités chacun
        par un entrepreneur individuel distinct, chacun responsable de ses propres
        ventes, de sa propre zone de livraison et de son propre encaissement :
      </LegalP>

      <LegalEntity
        name="Déclic Pizza Conches"
        lines={[
          'Exploitant : Thierry DUPONT, Entrepreneur individuel (artisan)',
          'SIREN : 452 109 002 — SIRET : 452 109 002 00033',
          'Adresse : 1 Place Carnot, 27190 Conches-en-Ouche',
          'Code APE : 5610C — Restauration de type rapide',
          'Téléphone : 02 32 38 41 77',
          'E-mail : declicpizza@gmail.com',
        ]}
      />

      <LegalEntity
        name="Déclic Pizza Beaumont"
        lines={[
          'Exploitant : Flora DUPONT, Entrepreneur individuel',
          'SIREN : 505 301 192 — SIRET : 505 301 192 00033',
          'Adresse : 66 Rue Saint Nicolas, 27170 Beaumont-le-Roger',
          'Code APE : 5610C — Restauration de type rapide',
          'Téléphone : 02 27 19 74 52',
          'E-mail : declicpizza@gmail.com',
        ]}
      />

      <LegalP>
        Les deux exploitants bénéficient de la franchise en base de TVA : TVA non
        applicable, article 293 B du Code général des impôts.
      </LegalP>
      <LegalP>
        Toute commande passée sur le Site implique l'acceptation sans réserve des
        présentes CGV par le client (« le Client »), envers l'exploitant de
        l'établissement choisi.
      </LegalP>

      <LegalH2>Article 2 — Produits et disponibilité</LegalH2>
      <LegalP>
        Les produits proposés sont ceux figurant sur le Site le jour de la commande,
        dans la limite des stocks disponibles et des horaires d'ouverture (du mardi au
        dimanche, 18h–22h). Les photographies et descriptifs n'ont pas de valeur
        contractuelle exhaustive quant à la présentation exacte du produit livré.
      </LegalP>
      <LegalP>
        Chaque exploitant se réserve le droit de modifier à tout moment sa carte, ses
        prix et ses disponibilités.
      </LegalP>

      <LegalH2>Article 3 — Prix</LegalH2>
      <LegalP>
        Les prix sont indiqués en euros. Conformément à la franchise en base de TVA
        (art. 293 B du CGI), la TVA n'est pas applicable et n'est pas facturée au
        Client. Les prix peuvent varier selon l'établissement (Conches ou Beaumont) et
        sont ceux affichés au moment de la validation de la commande.
      </LegalP>
      <LegalP>
        Les frais de livraison, le cas échéant, sont indiqués avant validation de la
        commande et dépendent de la distance entre l'établissement choisi et l'adresse
        de livraison, dans la limite de la zone de livraison de 12 km.
      </LegalP>

      <LegalH2>Article 4 — Commande</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">4.1.</strong> Le Client
        sélectionne un établissement (Conches ou Beaumont), compose sa commande,
        choisit le mode de retrait (livraison ou retrait sur place) et, en cas de
        livraison, renseigne une adresse comprise dans la zone de livraison de
        l'établissement concerné.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">4.2.</strong> Un récapitulatif
        de commande (produits, prix, mode de retrait, créneau souhaité) est présenté au
        Client avant validation.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">4.3.</strong> La validation
        de la commande accompagnée du paiement vaut acceptation ferme et définitive de
        la commande, sous réserve de confirmation par l'établissement (voir Article 6).
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">4.4. Créneau de livraison :</strong>{' '}
        le créneau indiqué par le Client lors de la commande est une proposition
        transmise à l'établissement. L'établissement peut, si nécessaire, proposer un
        créneau différent ; dans ce cas, le Client est recontacté directement
        (téléphone, SMS ou message via le Site) afin de convenir d'un nouveau créneau.
        La commande n'est considérée comme définitivement planifiée qu'après cette
        confirmation.
      </LegalP>

      <LegalH2>Article 5 — Paiement</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">5.1.</strong> Le paiement
        s'effectue en ligne, par carte bancaire, via le prestataire de paiement
        sécurisé Stripe. Chaque établissement dispose de son propre compte
        d'encaissement Stripe ; le Client est facturé directement par l'exploitant de
        l'établissement auprès duquel il commande.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">5.2. Autorisation et débit différé.</strong>{' '}
        Lors de la validation de la commande, le montant est pré-autorisé sur le moyen
        de paiement du Client. Le débit effectif (capture) n'intervient qu'après
        confirmation de la commande par l'établissement. Si l'établissement n'est pas
        en mesure d'honorer la commande, l'autorisation est annulée et aucun débit
        n'est effectué ; les délais de restitution de l'autorisation dépendent de la
        banque du Client.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">5.3.</strong> Aucune donnée
        bancaire n'est stockée par les exploitants ; celles-ci sont traitées
        exclusivement par Stripe, prestataire certifié PCI-DSS.
      </LegalP>

      <LegalH2>Article 6 — Confirmation, indisponibilité et annulation</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">6.1.</strong> Toute commande
        fait l'objet d'une confirmation par l'établissement concerné (via le Site, SMS
        ou téléphone).
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">6.2.</strong> En cas
        d'indisponibilité d'un produit ou d'impossibilité d'honorer la commande,
        l'établissement contacte le Client afin de proposer une alternative ou
        d'annuler la commande. En cas d'annulation, la pré-autorisation est levée et
        aucune somme n'est débitée.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">6.3.</strong> Le Client peut
        demander l'annulation de sa commande en contactant directement l'établissement
        concerné avant la préparation de celle-ci.
      </LegalP>

      <LegalH2>Article 7 — Livraison et retrait</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">7.1.</strong> La livraison
        est assurée dans un rayon de 12 km autour de l'établissement choisi, sous
        réserve de faisabilité.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">7.2.</strong> Les délais
        annoncés sont donnés à titre indicatif, sans garantie de résultat en cas de
        circonstances exceptionnelles (météo, afflux de commandes, etc.).
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">7.3.</strong> En cas
        d'absence du Client lors de la livraison, l'établissement le recontacte ; à
        défaut de le joindre dans un délai raisonnable, la commande peut être
        considérée comme non retirée, sans remboursement si les produits ont déjà été
        préparés.
      </LegalP>

      <LegalH2>Article 8 — Droit de rétractation</LegalH2>
      <LegalP>
        Conformément à l'article L221-28 4° du Code de la consommation, le droit de
        rétractation ne s'applique pas aux denrées alimentaires préparées,
        susceptibles de se détériorer ou de se périmer rapidement. Aucun droit de
        rétractation n'est donc applicable une fois la commande validée et en
        préparation.
      </LegalP>

      <LegalH2>Article 9 — Programme de fidélité</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">9.1.</strong> Le programme
        de fidélité est un dispositif optionnel, mis en place et géré par
        l'exploitant de l'établissement auprès duquel le Client commande (Conches ou
        Beaumont). L'exploitant peut activer un programme de fidélité par taille de
        pizza (Senior, Méga, Super Méga), avec des dates de début et de fin définies
        librement. Chaque établissement dispose de ses propres programmes,
        indépendants l'un de l'autre.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">9.2.</strong> Le programme
        permet au Client d'accumuler une remise : pour chaque pizza de la taille
        concernée commandée (hors Bambino), un compteur progresse. Une fois le seuil
        défini par l'exploitant atteint, une récompense est débloquée — une pizza
        offerte ou une remise en euros, selon le paramétrage du programme.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">9.3. Conservation de la
        récompense après la fin du programme.</strong> Si le Client obtient une
        récompense le dernier jour de la période de validité du programme (ou le jour
        de sa désactivation par l'exploitant), cette récompense reste entièrement
        utilisable lors de sa prochaine commande, même si le programme n'est plus
        actif à cette date. La fin du programme empêche l'acquisition de nouveaux
        points, mais n'annule pas une récompense déjà acquise ; celle-ci n'est perdue
        que par son utilisation ou par une annulation explicite de l'exploitant.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">9.4. Conditions
        d'application de la remise selon le mode de retrait.</strong> La récompense
        s'applique à une seule pizza de la taille concernée par commande :
      </LegalP>
      <LegalList
        items={[
          <>
            <strong className="font-semibold text-foreground">Commande à emporter
            :</strong> la remise s'applique à une seule pizza, sans minimum de
            commande spécifique.
          </>,
          <>
            <strong className="font-semibold text-foreground">Commande en livraison
            :</strong> le minimum de commande reste applicable — soit 2 pizzas Senior
            ou 1 pizza Méga, conformément aux règles de livraison de l'établissement.
            La pizza offerte (ou remisée) s'ajoute à ce minimum et ne s'y substitue
            pas.
          </>,
        ]}
      />
      <LegalP>
        <strong className="font-semibold text-foreground">9.5.</strong> Les programmes
        de fidélité des différentes tailles (Senior, Méga, Super Méga) sont
        indépendants et cumulables : un Client peut bénéficier simultanément de
        plusieurs récompenses au sein d'une même commande, dans la limite d'une
        récompense par taille et par commande.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">9.6.</strong> L'exploitant se
        réserve le droit d'activer, de désactiver ou de modifier à tout moment les
        programmes de fidélité, leurs seuils et leurs récompenses. Le Client ne peut
        prétendre à aucune contrepartie du fait de la modification ou de l'arrêt d'un
        programme, à l'exception des récompenses déjà acquises au moment de la
        modification, qui restent utilisables conformément à l'article 9.3.
      </LegalP>

      <LegalH2>Article 10 — Réclamations</LegalH2>
      <LegalP>
        <strong className="font-semibold text-foreground">10.1.</strong> Toute
        réclamation (produit non conforme, erreur de commande, retard, problème de
        livraison, question relative au paiement, etc.) doit être adressée directement
        à l'établissement auprès duquel la commande a été passée, aux coordonnées
        suivantes :
      </LegalP>
      <LegalList
        items={[
          <>
            Déclic Pizza Conches (Thierry Dupont) : téléphone 02 32 38 41 77 — chat
            disponible sur le Site — e-mail{' '}
            <a
              href="mailto:declicpizza@gmail.com"
              className="text-primary underline hover:text-primary/80"
            >
              declicpizza@gmail.com
            </a>
          </>,
          <>
            Déclic Pizza Beaumont (Flora Dupont) : téléphone 02 27 19 74 52 — chat
            disponible sur le Site — e-mail{' '}
            <a
              href="mailto:declicpizza@gmail.com"
              className="text-primary underline hover:text-primary/80"
            >
              declicpizza@gmail.com
            </a>
          </>,
        ]}
      />
      <LegalP>
        Le Client est invité à conserver et communiquer son numéro de commande afin
        de faciliter le traitement de sa demande. L'établissement s'engage à répondre
        dans les meilleurs délais.
      </LegalP>
      <LegalP>
        <strong className="font-semibold text-foreground">10.2.</strong> Conformément
        aux articles L616-1 et R616-1 du Code de la consommation, en cas d'échec de la
        réclamation directement auprès de l'établissement, le Client peut recourir
        gratuitement à un médiateur de la consommation, dans un délai d'un an à
        compter de la réclamation écrite. Médiateur en cours de désignation —
        coordonnées à venir.
      </LegalP>

      <LegalH2>Article 11 — Responsabilité</LegalH2>
      <LegalP>
        Les exploitants ne sauraient être tenus responsables de l'inexécution du
        contrat en cas de force majeure, de fait d'un tiers imprévisible et
        insurmontable, ou de faute du Client (adresse erronée, indisponibilité lors
        de la livraison, etc.).
      </LegalP>

      <LegalH2>Article 12 — Données personnelles</LegalH2>
      <LegalP>
        Le traitement des données personnelles du Client est décrit dans la Politique
        de Confidentialité / RGPD du Site.
      </LegalP>

      <LegalH2>Article 13 — Propriété intellectuelle</LegalH2>
      <LegalP>
        L'ensemble des éléments du Site (textes, logos, visuels, marque « Déclic
        Pizza ») est protégé par le droit de la propriété intellectuelle.
      </LegalP>

      <LegalH2>Article 14 — Droit applicable et litiges</LegalH2>
      <LegalP>
        Les présentes CGV sont soumises au droit français. À défaut de résolution
        amiable ou par médiation, les tribunaux français compétents seront seuls
        saisis.
      </LegalP>

      <LegalH2>Article 15 — Modification des CGV</LegalH2>
      <LegalP>
        Les CGV applicables sont celles en vigueur à la date de la commande.
      </LegalP>
    </LegalLayout>
  );
}
