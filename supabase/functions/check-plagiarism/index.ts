import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { content, checkId } = await req.json();
    if (!content || typeof content !== "string" || content.trim().length < 10) {
      throw new Error("Content must be at least 10 characters");
    }

    // Update status to processing
    await supabase
      .from("plagiarism_checks")
      .update({ status: "processing" })
      .eq("id", checkId);

    // Call Lovable AI for plagiarism analysis
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an advanced plagiarism and AI content detection expert. Analyze the given text and provide a detailed assessment. You MUST respond using the provided tool.

Your analysis should consider:
1. Writing style consistency — sudden shifts in tone, vocabulary level, or formality
2. Common AI-generated patterns — generic phrasing, lack of personal voice, repetitive structures
3. Potential paraphrasing indicators — awkward synonyms, unnatural sentence restructuring
4. Originality signals — unique perspectives, personal anecdotes, domain-specific knowledge
5. Structural analysis — paragraph flow, argument coherence, citation patterns

Be thorough but fair. Not all well-written text is plagiarized or AI-generated.`,
            },
            {
              role: "user",
              content: `Analyze this text for plagiarism and AI-generated content:\n\n${content.slice(0, 8000)}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "plagiarism_report",
                description: "Return a structured plagiarism and AI detection report",
                parameters: {
                  type: "object",
                  properties: {
                    similarity_score: {
                      type: "number",
                      description: "Overall similarity/plagiarism risk percentage (0-100)",
                    },
                    paraphrase_score: {
                      type: "number",
                      description: "Estimated paraphrase percentage (0-100)",
                    },
                    ai_probability: {
                      type: "number",
                      description: "Probability the text is AI-generated (0-100)",
                    },
                    flagged_sections: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string", description: "The flagged text excerpt" },
                          reason: { type: "string", description: "Why this section was flagged" },
                          risk: { type: "string", enum: ["low", "medium", "high"] },
                        },
                        required: ["text", "reason", "risk"],
                      },
                    },
                    summary: {
                      type: "string",
                      description: "A brief overall summary of the analysis findings",
                    },
                    recommendations: {
                      type: "array",
                      items: { type: "string" },
                      description: "Suggestions for improving originality",
                    },
                  },
                  required: [
                    "similarity_score",
                    "paraphrase_score",
                    "ai_probability",
                    "flagged_sections",
                    "summary",
                    "recommendations",
                  ],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "plagiarism_report" },
          },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured results");

    const report = JSON.parse(toolCall.function.arguments);

    // Save results
    const wordCount = content.trim().split(/\s+/).length;
    await supabase
      .from("plagiarism_checks")
      .update({
        status: "completed",
        similarity_score: report.similarity_score,
        paraphrase_score: report.paraphrase_score,
        match_count: report.flagged_sections?.length || 0,
        word_count: wordCount,
        results: report,
        content: content.slice(0, 50000),
      })
      .eq("id", checkId);

    // Update user quota (simple increment)
    const { data: quota } = await supabase
      .from("user_quotas")
      .select("words_used")
      .eq("user_id", user.id)
      .single();

    if (quota) {
      await supabase
        .from("user_quotas")
        .update({ words_used: (quota.words_used || 0) + wordCount })
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-plagiarism error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
