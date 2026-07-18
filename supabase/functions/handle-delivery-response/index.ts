import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const APP_URL = 'https://declicpizza.fr'

function redirect(status: string, orderId?: string): Response {
  const url = new URL(`${APP_URL}/profile`)
  url.searchParams.set('deliveryResponse', status)
  if (orderId) url.searchParams.set('order', orderId)
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url.toString() },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return redirect('error')
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return redirect('invalid')

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: tok, error: lookupErr } = await supabase
    .from('delivery_response_tokens')
    .select('token, order_id, action, used_at')
    .eq('token', token)
    .maybeSingle()

  if (lookupErr || !tok) return redirect('invalid')
  if (tok.used_at) return redirect('already', tok.order_id)

  // Load current order state
  const { data: order } = await supabase
    .from('orders')
    .select('id, delivery_response, status')
    .eq('id', tok.order_id)
    .maybeSingle()

  if (!order) return redirect('invalid')
  if (order.delivery_response) {
    // Already answered elsewhere: mark token as used and inform.
    await supabase.from('delivery_response_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
    return redirect('already', order.id)
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ delivery_response: tok.action })
    .eq('id', tok.order_id)

  if (updErr) {
    console.error('delivery-response update failed', updErr)
    return redirect('error', tok.order_id)
  }

  // Mark all tokens for this order used
  await supabase.from('delivery_response_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('order_id', tok.order_id)
    .is('used_at', null)

  return redirect(tok.action, tok.order_id)
})
