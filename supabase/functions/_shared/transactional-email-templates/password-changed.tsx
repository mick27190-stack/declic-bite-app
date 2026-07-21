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

interface PasswordChangedProps {
  customerName?: string
  changedAt?: string
}

const PasswordChangedEmail = ({ customerName, changedAt }: PasswordChangedProps) => {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre mot de passe Déclic Pizza a été modifié</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>🍕 Déclic Pizza</Heading>
          <Heading as="h2" style={title}>Mot de passe modifié</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Nous vous confirmons que le mot de passe de votre compte Déclic Pizza
            a été modifié avec succès.
          </Text>
          <Section style={infoBox}>
            <Text style={infoLabel}>Date et heure du changement :</Text>
            <Text style={infoValue}>{changedAt || 'à l’instant'}</Text>
          </Section>
          <Text style={text}>
            Si vous êtes bien à l’origine de cette modification, aucune action
            n’est requise de votre part.
          </Text>
          <Text style={alertText}>
            ⚠️ Si vous <strong>n’êtes pas à l’origine</strong> de ce changement,
            votre compte pourrait être compromis. Nous vous recommandons de :
          </Text>
          <Text style={text}>
            • Réinitialiser immédiatement votre mot de passe via l’application<br />
            • Nous contacter au plus vite pour sécuriser votre compte
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
  component: PasswordChangedEmail,
  subject: 'Votre mot de passe a été modifié — Déclic Pizza',
  displayName: 'Confirmation de changement de mot de passe',
  previewData: {
    customerName: 'Jean Dupont',
    changedAt: 'mardi 21 juillet 2026 à 14:32 (heure de Paris)',
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
