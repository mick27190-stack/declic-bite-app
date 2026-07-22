import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Resend the email verification link for the authenticated caller.
// Handles the edge case where the target email is already registered on
// another auth account: if that other account has no linked profile (i.e.
// it's an orphan / previously anonymized account), we remove it and then
// attach the email to the caller. Active accounts belonging to another
// real user are never overwritten.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const jwt = authHeader.slice('bearer '.length).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { email?: string; redirectTo?: string } = {}
  try {
    body = await req.json()
  } catch {
    // ignore
  }
  const targetEmail = (body.email ?? '').trim().toLowerCase()
  const redirectTo = body.redirectTo || undefined
  if (!targetEmail) {
    return new Response(JSON.stringify({ error: 'Email requis' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt)
  const callerId = claimsData?.claims?.sub as string | undefined
  if (claimsError || !callerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Locate any existing auth user with this email.
  let conflictUserId: string | null = null
  try {
    // listUsers supports filtering by email via query.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const match = list?.users?.find((u) => (u.email ?? '').toLowerCase() === targetEmail)
    if (match && match.id !== callerId) conflictUserId = match.id
  } catch (e) {
    console.error('listUsers failed:', (e as Error).message)
  }

  if (conflictUserId) {
    // Check whether that account still has an active profile.
    const { data: otherProfile } = await admin
      .from('profiles')
      .select('user_id, phone, first_name, last_name')
      .eq('user_id', conflictUserId)
      .maybeSingle()

    const isOrphan =
      !otherProfile ||
      (!otherProfile.phone && !otherProfile.first_name && !otherProfile.last_name)

    if (!isOrphan) {
      return new Response(
        JSON.stringify({
          error:
            "Cette adresse email est déjà utilisée par un autre compte actif. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Orphan / previously anonymized account → clean it up so the email frees up.
    try {
      await admin.rpc('anonymize_user_orders', { user_id_param: conflictUserId })
    } catch (e) {
      console.error('anonymize_user_orders (orphan) failed:', (e as Error).message)
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(conflictUserId)
    if (delErr) {
      console.error('deleteUser (orphan) failed:', delErr.message)
      return new Response(
        JSON.stringify({ error: "Impossible de libérer l'adresse email. Réessayez plus tard." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // Attach (or re-attach) the email to the caller. This triggers the
  // confirmation email through the standard auth flow.
  const { data: caller } = await admin.auth.admin.getUserById(callerId)
  const currentEmail = (caller?.user?.email ?? '').toLowerCase()
  const alreadyAttached = currentEmail === targetEmail

  if (!alreadyAttached) {
    // Call GoTrue REST directly with the user JWT so the confirmation email is sent.
    // (SDK's auth.updateUser requires a persisted session which we don't have here.)
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: targetEmail,
        ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('updateUser (REST) failed:', resp.status, errText)
      let msg = errText
      try { msg = JSON.parse(errText).msg || JSON.parse(errText).error_description || errText } catch {}
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    // Email already attached and unconfirmed → resend signup confirmation via REST.
    const resp = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'signup',
        email: targetEmail,
        ...(redirectTo ? { options: { email_redirect_to: redirectTo } } : {}),
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('resend (REST) failed:', resp.status, errText)
      let msg = errText
      try { msg = JSON.parse(errText).msg || JSON.parse(errText).error_description || errText } catch {}
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }


  // Persist to profile too.
  try {
    await admin.from('profiles').update({ email: targetEmail }).eq('user_id', callerId)
  } catch (e) {
    console.error('profile email sync failed:', (e as Error).message)
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
