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
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface InvoiceEmailProps {
  customerName?: string
  invoiceNumber?: string
  orderDate?: string
  totalTTC?: string
  downloadUrl?: string
  companyName?: string
}

const InvoiceEmail = ({
  customerName,
  invoiceNumber,
  orderDate,
  totalTTC,
  downloadUrl,
  companyName,
}: InvoiceEmailProps) => {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre facture Déclic Pizza est disponible</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>🍕 Déclic Pizza</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Suite à votre demande, vous trouverez votre facture
            {invoiceNumber ? ` n° ${invoiceNumber}` : ''}
            {orderDate ? ` du ${orderDate}` : ''} en pièce téléchargeable ci-dessous.
          </Text>
          {totalTTC && (
            <Text style={text}>
              <strong>Montant total TTC :</strong> {totalTTC}
            </Text>
          )}
          {downloadUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
              <Button href={downloadUrl} style={btn}>
                📄 Télécharger ma facture (PDF)
              </Button>
            </Section>
          )}
          <Text style={textSmall}>
            Ce lien de téléchargement est sécurisé et valable pendant 30 jours.
          </Text>
          <Text style={text}>
            Merci de votre confiance et à très bientôt chez {companyName || 'Déclic Pizza'}.
          </Text>
          <Text style={text}>
            Cordialement,
            <br />
            L’équipe {companyName || 'Déclic Pizza'}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InvoiceEmail,
  subject: 'Votre facture Déclic Pizza',
  displayName: 'Facture client',
  previewData: {
    customerName: 'Jean Dupont',
    invoiceNumber: 'F-20260720-ABCDEF',
    orderDate: '20/07/2026',
    totalTTC: '32,50€',
    downloadUrl: 'https://declicpizza.fr/',
    companyName: 'Déclic Pizza',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const brand = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#f97316',
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: '#1a1310',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const textSmall = {
  fontSize: '13px',
  color: '#6b5b52',
  lineHeight: '1.5',
  margin: '0 0 16px',
  textAlign: 'center' as const,
}
const btn = {
  display: 'inline-block',
  padding: '14px 26px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  backgroundColor: '#f97316',
  textDecoration: 'none',
}
