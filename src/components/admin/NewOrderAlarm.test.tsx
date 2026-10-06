import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const order = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  site: 'beaumont',
  restaurant: 'beaumont',
  created_at: new Date().toISOString(),
  status: 'pending',
  capture_status: 'requires_capture',
  acquittee_le: null,
};

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {};
  ['select', 'eq', 'is', 'order'].forEach((m) => (chain[m] = () => chain));
  chain.maybeSingle = () => Promise.resolve({ data: null });
  chain.then = (cb: any) => Promise.resolve({ data: [order] }).then(cb);
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => chain,
      channel: () => channel,
      removeChannel: vi.fn(),
      rpc: vi.fn(() => Promise.resolve({ error: null })),
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/contexts/AdminContext', () => ({
  useAdmin: () => ({
    isSuperAdmin: false,
    isSiteAdminConches: false,
    isSiteAdminBeaumont: true,
    isSecondaryAdminConches: false,
    isSecondaryAdminBeaumont: false,
  }),
}));
vi.mock('@/hooks/useWakeLock', () => ({ useWakeLock: () => {} }));

const playAlarmSound = vi.fn();
vi.mock('@/lib/notificationSounds', () => ({
  initNotificationSounds: vi.fn(),
  initNotificationSoundsCtxOnly: vi.fn(),
  isAudioUnlocked: () => false,
  playAlarmSound: (...a: unknown[]) => playAlarmSound(...a),
  getAlarmSettings: () => ({ sound: 'siren', volume: 80, duration: 5 }),
  soundForSite: (s: any) => s.sound,
  customSoundForSite: () => null,
  ALARM_SETTINGS_EVENT: 'alarm-settings-changed',
}));

import NewOrderAlarm from './NewOrderAlarm';

describe('NewOrderAlarm', () => {
  beforeEach(() => playAlarmSound.mockClear());

  it('le premier toucher lance immédiatement la sonnerie quand une commande apparaît', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <NewOrderAlarm />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nouvelle commande !')).toBeInTheDocument();

    // Ignore la tentative automatique (bloquée sur mobile sans geste).
    playAlarmSound.mockClear();

    fireEvent.touchEnd(window);

    // Lancée de façon synchrone dans le geste, sans attendre la répétition.
    expect(playAlarmSound).toHaveBeenCalled();
    expect(playAlarmSound.mock.calls[0][0]).toMatchObject({ sound: 'siren' });
  });
});
