/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion Déclic Pizza 🍕</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>🍕 Déclic Pizza</Heading>
        <Heading style={h1}>Votre lien de connexion</Heading>
        <Text style={text}>
          Cliquez sur le bouton ci-dessous pour vous connecter à Déclic Pizza.
          Ce lien expirera prochainement.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Se connecter
        </Button>
        <Text style={footer}>
          Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '480px' }
const brand = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#f97316',
  margin: '0 0 24px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a1310',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#55575d',
  lineHeight: '1.6',
  margin: '0 0 28px',
}
const button = {
  backgroundColor: '#f97316',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '16px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
