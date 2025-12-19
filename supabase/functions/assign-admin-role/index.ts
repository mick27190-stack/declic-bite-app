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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_id, phone } = await req.json();

    if (!user_id || !phone) {
      return new Response(
        JSON.stringify({ error: "user_id and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if phone is in admin_phones
    const { data: adminPhone, error: fetchError } = await supabase
      .from("admin_phones")
      .select("*")
      .eq("phone", phone)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching admin phone:", fetchError);
      return new Response(
        JSON.stringify({ error: "Error checking admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminPhone) {
      // Check if role already assigned
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user_id)
        .eq("role", adminPhone.role)
        .single();

      if (!existingRole) {
        // Assign the role
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({
            user_id,
            role: adminPhone.role,
            assigned_by: adminPhone.created_by
          });

        if (insertError) {
          console.error("Error assigning role:", insertError);
          return new Response(
            JSON.stringify({ error: "Error assigning role" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Role assigned successfully",
            role: adminPhone.role 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Role already assigned",
          role: adminPhone.role 
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
