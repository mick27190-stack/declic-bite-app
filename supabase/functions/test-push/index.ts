// Test helper: sends a real FCM push to the *currently authenticated* user's
// own devices so they can verify background delivery on iOS / Android.
// It inserts a notification row, which fires the existing send-push pipeline,
// exercising the full chain end-to-end.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // How many devices are registered for this user?
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    const deviceCount = tokens?.length ?? 0;

    if (deviceCount === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          deviceCount: 0,
          message:
            "Aucun appareil enregistré. Autorisez les notifications puis réessayez.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert a notification -> trg_send_push_on_notification fires send-push.
    const { error: insertError } = await admin.from("notifications").insert({
      user_id: userId,
      title: "🔔 Test de notification push",
      body: "Si vous voyez ce message en arrière-plan, le push FCM fonctionne !",
      type: "new_message",
      site: "conches",
    });

    if (insertError) {
      return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        deviceCount,
        message: `Push de test envoyé à ${deviceCount} appareil(s).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[test-push] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
