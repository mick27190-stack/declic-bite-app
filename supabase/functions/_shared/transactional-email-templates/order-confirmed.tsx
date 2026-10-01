/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Item { label?: string; details?: string; quantity?: number; price?: string }
interface Props {
  customerName?: string
  orderNumber?: string
  restaurant?: string
  orderType?: string
  timeLabel?: string
  time?: string
  items?: Item[]
  total?: string
}

const OrderConfirmedEmail = ({
  customerName, orderNumber, restaurant, orderType, timeLabel, time, items = [], total,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre commande {orderNumber ? `n° ${orderNumber} ` : ''}est confirmée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>🍕 Déclic Pizza</Heading>
        <Text style={text}>{customerName ? `Bonsoir ${customerName},` : 'Bonsoir,'}</Text>
        <Text style={text}>Bonne nouvelle : votre commande est <strong>confirmée</strong> !</Text>
        <Section style={box}>
          {orderNumber && <Text style={line}><strong>Commande n° :</strong> {orderNumber}</Text>}
          {restaurant && <Text style={line}><strong>Établissement :</strong> {restaurant}</Text>}
          {orderType && <Text style={line}><strong>Type :</strong> {orderType}</Text>}
          {time && <Text style={line}><strong>{timeLabel ?? 'Horaire'} :</strong> {time}</Text>}
        </Section>
        <Text style={subtitle}>Récapitulatif</Text>
        {items.map((it, i) => (
          <Text key={i} style={line}>
            {it.quantity ?? 1} × {it.label}{it.price ? ` — ${it.price}` : ''}
            {it.details ? <><br /><span style={details}>{it.details}</span></> : null}
          </Text>
        ))}
        <Hr style={{ borderColor: '#eee' }} />
        {total && <Text style={totalStyle}>Total : {total}</Text>}
        <Text style={text}>Merci pour votre commande et à très bientôt !<br />L’équipe Déclic Pizza.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmedEmail,
  subject: (d: Record<string, unknown>) =>
    `Commande ${d.orderNumber ? `n° ${d.orderNumber} ` : ''}confirmée — Déclic Pizza`,
  displayName: 'Commande confirmée',
  previewData: {
    customerName: 'Jean Dupont', orderNumber: 'AB12CD34', restaurant: 'Déclic Pizza Conches',
    orderType: 'Livraison', timeLabel: 'Horaire de livraison', time: '20:30',
    items: [{ label: 'Margherita', details: 'Senior · Base tomate', quantity: 1, price: '9,00€' },
      { label: 'Coca-Cola', quantity: 1, price: '2,50€' }],
    total: '11,50€',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px' }
const brand = { fontSize: '26px', fontWeight: 'bold' as const, color: '#f97316', margin: '0 0 24px' }
const text = { fontSize: '15px', color: '#1a1310', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#fff7ed', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }
const line = { fontSize: '14px', color: '#1a1310', lineHeight: '1.5', margin: '0 0 6px' }
const details = { fontSize: '12px', color: '#6b5b52' }
const subtitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1a1310', margin: '8px 0' }
const totalStyle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#f97316', margin: '8px 0 16px' }
