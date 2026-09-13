/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface CancelledLine {
  label?: string
  details?: string
  quantity?: number
  price?: string
}

interface OrderCancelledProps {
  customerName?: string
  orderNumber?: string
  orderDate?: string
  restaurant?: string
  orderType?: string
  reasonMessage?: string
  items?: CancelledLine[]
  total?: string
}

const OrderCancelledEmail = ({
  customerName,
  orderNumber,
  orderDate,
  restaurant,
  orderType,
  reasonMessage,
  items,
  total,
}: OrderCancelledProps) => {
  const greeting = customerName ? `Bonjour ${customerName},` : 'Bonjour,'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre commande Déclic Pizza a été annulée — aucun débit</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>🍕 Déclic Pizza</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Votre commande{orderNumber ? ` n° ${orderNumber}` : ''}
            {restaurant ? ` (${restaurant})` : ''}
            {orderDate ? ` du ${orderDate}` : ''} a bien été annulée.
          </Text>
          {reasonMessage && (
            <Section style={reasonBox}>
              <Text style={reasonText}>{reasonMessage}</Text>
            </Section>
          )}
          <Section style={infoBox}>
            <Text style={infoText}>
              💳 <strong>Aucun montant ne sera débité de votre compte bancaire.</strong> La
              pré-autorisation réalisée lors de la commande a été libérée : selon votre banque,
              elle peut rester affichée quelques jours avant de disparaître automatiquement.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={subheading}>Récapitulatif de votre commande</Text>
          {orderType && <Text style={textSmall}>Type : {orderType}</Text>}
          {(items ?? []).map((line, i) => (
            <Text key={i} style={lineText}>
              <strong>
                {line.quantity && line.quantity > 1 ? `${line.quantity}× ` : ''}
                {line.label}
              </strong>
              {line.price ? ` — ${line.price}` : ''}
              {line.details ? (
                <>
                  <br />
                  <span style={detailsText}>{line.details}</span>
                </>
              ) : null}
            </Text>
          ))}
          {total && (
            <Text style={totalText}>
              Total de la commande annulée : <strong>{total}</strong> (non encaissé)
            </Text>
          )}
          <Hr style={hr} />
          <Text style={text}>
            Vous pouvez repasser commande à tout moment depuis notre site. Nous restons à votre
            disposition pour toute question.
          </Text>
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
  component: OrderCancelledEmail,
  subject: 'Votre commande Déclic Pizza a été annulée',
  displayName: 'Commande annulée',
  previewData: {
    customerName: 'Jean Dupont',
    orderNumber: 'A1B2C3D4',
    orderDate: '13/09/2026 à 19:45',
    restaurant: 'Déclic Pizza Conches',
    orderType: 'Livraison',
    reasonMessage:
      'Vous avez annulé le paiement de votre commande sur la page de paiement sécurisée.',
    items: [
      { label: 'Margherita', details: 'Senior · Base tomate · Suppléments : Bacon', quantity: 1, price: '10,00€' },
    ],
    total: '10,00€',
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
const text = { fontSize: '15px', color: '#1a1310', lineHeight: '1.6', margin: '0 0 16px' }
const subheading = {
  fontSize: '16px',
  fontWeight: 'bold' as const,
  color: '#1a1310',
  margin: '0 0 12px',
}
const textSmall = { fontSize: '13px', color: '#6b5b52', lineHeight: '1.5', margin: '0 0 12px' }
const lineText = { fontSize: '14px', color: '#1a1310', lineHeight: '1.5', margin: '0 0 10px' }
const detailsText = { fontSize: '13px', color: '#6b5b52' }
const totalText = { fontSize: '15px', color: '#1a1310', margin: '12px 0 0' }
const reasonBox = {
  backgroundColor: '#fff7ed',
  borderLeft: '4px solid #f97316',
  padding: '12px 16px',
  margin: '0 0 16px',
}
const reasonText = { fontSize: '14px', color: '#7c2d12', lineHeight: '1.6', margin: '0' }
const infoBox = {
  backgroundColor: '#f0fdf4',
  borderLeft: '4px solid #16a34a',
  padding: '12px 16px',
  margin: '0 0 16px',
}
const infoText = { fontSize: '14px', color: '#14532d', lineHeight: '1.6', margin: '0' }
const hr = { borderColor: '#f0e6e0', margin: '24px 0' }
