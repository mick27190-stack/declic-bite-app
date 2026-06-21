import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require a valid JWT and derive the caller identity from it.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identity comes ONLY from the verified JWT, never from the request body.
    const user_id = userData.user.id;
    const phone = userData.user.phone ? `+${userData.user.phone.replace(/^\+/, "")}` : null;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: true, message: "No phone on account" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // A phone may have several roles (e.g. secondary super admin + site admin).
    // Only active entries grant a role.
    const { data: adminPhones, error: fetchError } = await supabase
      .from("admin_phones")
      .select("*")
      .eq("phone", phone)
      .eq("active", true);

    if (fetchError) {
      console.error("Error fetching admin phone:", fetchError);
      return new Response(
        JSON.stringify({ error: "Error checking admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminPhones && adminPhones.length > 0) {
      // Roles already assigned to this user.
      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);

      const existing = new Set((existingRoles ?? []).map((r) => r.role));

      const toInsert = adminPhones
        .filter((ap) => !existing.has(ap.role))
        .map((ap) => ({
          user_id,
          role: ap.role,
          assigned_by: ap.created_by,
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(toInsert);

        if (insertError) {
          console.error("Error assigning roles:", insertError);
          return new Response(
            JSON.stringify({ error: "Error assigning role" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: toInsert.length > 0 ? "Roles assigned successfully" : "Roles already assigned",
          roles: adminPhones.map((ap) => ap.role),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "No admin role for this phone" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );


  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
