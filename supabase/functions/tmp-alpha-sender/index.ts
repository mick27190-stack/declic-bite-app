// Temporary utility: register an alphanumeric sender ID on the Twilio messaging service.
Deno.serve(async (req) => {
  const { serviceSid, alphaSender } = await req.json().catch(() => ({}));
  const res = await fetch(
    `https://connector-gateway.lovable.dev/twilio/messaging/v1/Services/${serviceSid}/AlphaSenders`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'X-Connection-Api-Key': Deno.env.get('TWILIO_API_KEY') ?? '',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ AlphaSender: alphaSender }),
    },
  );
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
