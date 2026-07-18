/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface DeliveryEstimateProps {
  customerName?: string
  requestedTime?: string
  estimatedTime?: string
}

const DeliveryEstimateEmail = ({
  customerName,
  requestedTime,
  estimatedTime,
}: DeliveryEstimateProps) => {
  const greeting = customerName
    ? `Bonsoir ${customerName},`
    : 'Bonsoir,'
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
            Merci de vous rendre dès que possible au niveau de votre commande en
            cours dans votre profil client de l’application pour{' '}
            <strong>ACCEPTER</strong> ou <strong>REFUSER</strong> le nouvel
            horaire estimé de votre livraison.
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
