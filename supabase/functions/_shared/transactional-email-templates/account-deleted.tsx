/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AccountDeletedProps {
  customerName?: string
  deletedAt?: string
}

const AccountDeletedEmail = ({ customerName, deletedAt }: AccountDeletedProps) => {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre compte Déclic Pizza a été supprimé</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>🍕 Déclic Pizza</Heading>
          <Heading as="h2" style={title}>Compte supprimé</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Nous vous confirmons que votre compte Déclic Pizza ainsi que vos
            informations personnelles (profil, adresses, moyens de contact) ont
            été supprimés de nos systèmes.
          </Text>
          <Section style={infoBox}>
            <Text style={infoLabel}>Date et heure de la suppression :</Text>
            <Text style={infoValue}>{deletedAt || 'à l’instant'}</Text>
          </Section>
          <Text style={text}>
            Conformément à nos obligations légales (facturation, comptabilité),
            certaines données liées à vos commandes passées peuvent être
            conservées de manière anonymisée pendant la durée requise par la loi.
          </Text>
          <Text style={alertText}>
            ⚠️ Si vous <strong>n’êtes pas à l’origine</strong> de cette suppression,
            merci de nous contacter au plus vite.
          </Text>
          <Text style={text}>
            Nous sommes tristes de vous voir partir et espérons vous revoir
            bientôt autour d’une bonne pizza. 🍕
          </Text>
          <Text style={text}>
            Cordialement,<br />
            L’équipe Déclic Pizza.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccountDeletedEmail,
  subject: 'Votre compte a été supprimé — Déclic Pizza',
  displayName: 'Confirmation de suppression de compte',
  previewData: {
    customerName: 'Jean Dupont',
    deletedAt: 'mardi 21 juillet 2026 à 14:32 (heure de Paris)',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const brand = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#f97316',
  margin: '0 0 8px',
}
const title = {
  fontSize: '20px',
  color: '#1a1310',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#1a1310',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const alertText = {
  ...text,
  color: '#b91c1c',
}
const infoBox = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '0 0 20px',
}
const infoLabel = {
  fontSize: '13px',
  color: '#6b5b52',
  margin: '0 0 4px',
}
const infoValue = {
  fontSize: '15px',
  color: '#1a1310',
  fontWeight: 'bold' as const,
  margin: 0,
}
