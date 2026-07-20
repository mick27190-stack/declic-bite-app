ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
UPDATE public.chat_messages SET delivered_at = read_at WHERE delivered_at IS NULL AND read_at IS NOT NULL;