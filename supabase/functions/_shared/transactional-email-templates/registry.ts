/// <reference types="npm:@types/react@18.3.1" />

import type * as React from 'npm:react@18.3.1'
import { template as deliveryEstimate } from './delivery-estimate.tsx'
import { template as invoice } from './invoice.tsx'
import { template as passwordChanged } from './password-changed.tsx'
import { template as accountDeleted } from './account-deleted.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, unknown>) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'delivery-estimate': deliveryEstimate,
  'invoice': invoice,
  'password-changed': passwordChanged,
  'account-deleted': accountDeleted,
}
