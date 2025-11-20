import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface StreamCheckRequest {
  streamId: string;
  rtspUrl: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check endpoint
    if (path.endsWith("/health")) {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check stream status
    if (path.endsWith("/check") && req.method === "POST") {
      const { streamId, rtspUrl }: StreamCheckRequest = await req.json();

      if (!streamId || !rtspUrl) {
        return new Response(
          JSON.stringify({ error: "streamId and rtspUrl are required" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Check if RTSP stream is accessible
      const isLive = await checkRtspStream(rtspUrl);

      // Update stream status in database
      const { error: updateError } = await supabase
        .from("streams")
        .update({
          status: isLive ? "live" : "offline",
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", streamId);

      if (updateError) {
        console.error("Error updating stream status:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update stream status" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          streamId,
          status: isLive ? "live" : "offline",
          checkedAt: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check all active streams
    if (path.endsWith("/check-all") && req.method === "POST") {
      const { data: streams, error: fetchError } = await supabase
        .from("streams")
        .select("id, rtsp_url, input_type")
        .eq("input_type", "rtsp")
        .not("rtsp_url", "is", null);

      if (fetchError) {
        console.error("Error fetching streams:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch streams" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const results = [];

      for (const stream of streams || []) {
        if (!stream.rtsp_url) continue;

        const isLive = await checkRtspStream(stream.rtsp_url);

        await supabase
          .from("streams")
          .update({
            status: isLive ? "live" : "offline",
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", stream.id);

        results.push({
          streamId: stream.id,
          status: isLive ? "live" : "offline",
        });
      }

      return new Response(
        JSON.stringify({
          checked: results.length,
          results,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in stream-processor:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

// Check if RTSP stream is accessible
async function checkRtspStream(rtspUrl: string): Promise<boolean> {
  try {
    // Parse RTSP URL
    const url = new URL(rtspUrl);
    const host = url.hostname;
    const port = url.port || "554";

    // Try to connect to RTSP server (basic TCP connection check)
    const conn = await Deno.connect({
      hostname: host,
      port: parseInt(port),
      transport: "tcp",
    });

    // If connection succeeds, close it and return true
    conn.close();
    return true;
  } catch (error) {
    console.error(`RTSP stream check failed for ${rtspUrl}:`, error.message);
    return false;
  }
}
