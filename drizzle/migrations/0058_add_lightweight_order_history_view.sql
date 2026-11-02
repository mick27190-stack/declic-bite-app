CREATE VIEW public.order_history_readable WITH (security_invoker = true) AS
SELECT h.id, h.week_start, h.week_end, h.order_count, h.total_revenue, h.created_at, h.site,
  COALESCE((
    SELECT jsonb_agg(
      CASE WHEN jsonb_typeof(o.value -> 'items') = 'array' THEN
        jsonb_set(o.value, '{items}', COALESCE((
          SELECT jsonb_agg(
            CASE WHEN jsonb_typeof(i.value -> 'pizza') = 'object'
              THEN jsonb_set(i.value, '{pizza}', (i.value -> 'pizza') - 'image')
              ELSE i.value END ORDER BY i.ordinality
          ) FROM jsonb_array_elements(o.value -> 'items') WITH ORDINALITY AS i(value, ordinality)
        ), '[]'::jsonb))
      ELSE o.value END ORDER BY o.ordinality
    ) FROM jsonb_array_elements(h.orders) WITH ORDINALITY AS o(value, ordinality)
  ), '[]'::jsonb) AS orders
FROM public.order_history h;
GRANT SELECT ON public.order_history_readable TO authenticated;
GRANT ALL ON public.order_history_readable TO service_role;
COMMENT ON VIEW public.order_history_readable IS 'Read-only archive projection without unused embedded product images. Original archives remain intact; security_invoker preserves site-scoped order_history RLS.';