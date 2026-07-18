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

interface DeliveryEstimateProps {
  customerName?: string
  requestedTime?: string
  estimatedTime?: string
  acceptUrl?: string
  refuseUrl?: string
}

const DeliveryEstimateEmail = ({
  customerName,
  requestedTime,
  estimatedTime,
  acceptUrl,
  refuseUrl,
}: DeliveryEstimateProps) => {
  const greeting = customerName ? `Bonsoir ${customerName},` : 'Bonsoir,'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Nouvel horaire de livraison proposé — merci de confirmer</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>🍕 Déclic Pizza</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Malheureusement nos disponibilités de livraison ne nous permettent pas
            de livrer votre commande à l’heure que vous souhaitez
            {requestedTime ? ` (${requestedTime})` : ''}, nous vous proposons un
            nouvel horaire de livraison estimée
            {estimatedTime ? ` : ${estimatedTime}` : ''}.
          </Text>
          <Text style={text}>
            Vous pouvez répondre directement depuis cet e-mail :
          </Text>
          {(acceptUrl || refuseUrl) && (
            <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
              {acceptUrl && (
                <Button href={acceptUrl} style={acceptBtn}>
                  ✅ ACCEPTER
                </Button>
              )}
              {refuseUrl && (
                <Button href={refuseUrl} style={refuseBtn}>
                  ❌ REFUSER
                </Button>
              )}
            </Section>
          )}
          <Text style={textSmall}>
            Vous pouvez également répondre depuis votre profil client dans
            l’application.
          </Text>
          <Text style={text}>
            En cas de <strong>REFUS</strong> de votre part, votre commande sera
            automatiquement annulée.
          </Text>
          <Text style={text}>Merci de votre compréhension.</Text>
          <Text style={text}>
            Cordialement,
            <br />
            L’équipe Déclic Pizza.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DeliveryEstimateEmail,
  subject: 'Nouvel horaire de livraison proposé — Déclic Pizza',
  displayName: 'Nouvel horaire de livraison',
  previewData: {
    customerName: 'Jean Dupont',
    requestedTime: '20:00',
    estimatedTime: '20:30',
    acceptUrl: 'https://declicpizza.fr/',
    refuseUrl: 'https://declicpizza.fr/',
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
const btnBase = {
  display: 'inline-block',
  padding: '12px 22px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  textDecoration: 'none',
  margin: '0 8px',
}
const acceptBtn = { ...btnBase, backgroundColor: '#16a34a' }
const refuseBtn = { ...btnBase, backgroundColor: '#dc2626' }
