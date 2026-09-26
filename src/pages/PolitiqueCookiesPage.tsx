import { LegalLayout, LegalH2, LegalP, LegalList } from '@/components/LegalLayout';
import { Button } from '@/components/ui/button';
import { openCookiePreferences } from '@/lib/cookieConsent';

export default function PolitiqueCookiesPage() {
  return (
    <LegalLayout title="Politique de cookies">
      <LegalH2>Qu'est-ce qu'un cookie ?</LegalH2>
      <LegalP>Un cookie (ou traceur) est une petite donnée enregistrée sur votre appareil lors de la visite d'un site. Il permet de mémoriser des informations comme votre panier ou votre connexion.</LegalP>
      <LegalH2>Cookies essentiels</LegalH2>
      <LegalP>Toujours actifs, ils sont nécessaires au fonctionnement du site et ne requièrent pas votre consentement :</LegalP>
      <LegalList items={['Panier et restaurant choisi', 'Connexion à votre compte', 'Paiement sécurisé (Stripe)', 'Mémorisation de vos choix de cookies']} />
      <LegalH2>Cookies de mesure d'audience</LegalH2>
      <LegalP>Soumis à votre accord, ils servent à mesurer la fréquentation du site (Google Analytics et outil d'analyse de la plateforme d'hébergement). Aucune donnée n'est utilisée à des fins publicitaires. Certaines statistiques de fréquentation anonymes peuvent être produites par l'hébergeur indépendamment du site.</LegalP>
      <LegalH2>Durée de conservation</LegalH2>
      <LegalP>Votre choix est conservé sur votre appareil. Vous pouvez le modifier à tout moment.</LegalP>
      <div className="mt-4">
        <Button onClick={openCookiePreferences}>Gérer mes cookies</Button>
      </div>
    </LegalLayout>
  );
}
