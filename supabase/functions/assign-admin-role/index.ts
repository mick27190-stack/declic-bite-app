import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

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
    const normalizedPhone = normalizePhone(phone);

    if (!phone) {
      return new Response(
        JSON.stringify({ success: true, message: "No phone on account" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // A phone may have several roles (e.g. secondary super admin + site admin).
    // Only active entries grant a role. Match numbers with or without leading `+`.
    const { data: allActiveAdminPhones, error: fetchError } = await supabase
      .from("admin_phones")
      .select("*")
      .eq("active", true);

    if (fetchError) {
      console.error("Error fetching admin phone:", fetchError);
      return new Response(
        JSON.stringify({ error: "Error checking admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminPhones = (allActiveAdminPhones ?? []).filter(
      (ap) => normalizePhone(ap.phone) === normalizedPhone,
    );

    // All roles that are managed through admin_phones (admins + livreurs).
    // These must be kept in sync: granted only while an active admin_phones
    // entry exists, and revoked as soon as it is deactivated/removed.
    const MANAGED_ROLES = [
      "super_admin",
      "secondary_super_admin",
      "site_admin_conches",
      "site_admin_beaumont",
      "secondary_admin_conches",
      "secondary_admin_beaumont",
      "livreur_conches",
      "livreur_beaumont",
    ];

    const activeRoles = new Set(adminPhones.map((ap) => ap.role));

    // Current managed roles already on the account.
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);

    const existing = new Set((existingRoles ?? []).map((r) => r.role));

    // Revoke any managed role that is no longer backed by an active admin_phones entry
    // (e.g. a livreur or admin that was deactivated in the admin section).
    const toRemove = MANAGED_ROLES.filter(
      (role) => existing.has(role) && !activeRoles.has(role),
    );

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .in("role", toRemove);

      if (deleteError) {
        console.error("Error revoking roles:", deleteError);
        return new Response(
          JSON.stringify({ error: "Error revoking role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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
        message: "Roles synchronized successfully",
        role: adminPhones[0]?.role,
        roles: adminPhones.map((ap) => ap.role),
      }),
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
