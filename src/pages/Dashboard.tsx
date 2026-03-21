import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Shield, Upload, Trash2, ChevronLeft, ChevronRight, Info, Search, Globe, FileText, Bot, User, History, LogOut, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/lib/fileExtractor";
import { generateAIWritingReport } from "@/lib/generateAIWritingReport";
import { generateSimilarityReport } from "@/lib/generateSimilarityReport";

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: { text: string; reason: string; risk: string }[];
  summary: string;
  recommendations: string[];
}

function SimilarityDonut({ percent, label }: { percent: number; label: string }) {
  const r = 54, c = 2 * Math.PI * r;
  const color = percent < 15 ? "hsl(142, 71%, 45%)" : percent < 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 60%)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * percent / 100)} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-foreground tabular-nums">{percent}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}



export default function Dashboard() {
  const { signOut, session } = useAuth();
  const [text, setText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [language, setLanguage] = useState("auto");
  const [superSearch, setSuperSearch] = useState(false);
  const [scholarSearch, setScholarSearch] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleCheck = async () => {
    if (!text.trim() || wordCount < 5) {
      toast({ title: "Too short", description: "Please enter at least 5 words to analyze.", variant: "destructive" });
      return;
    }
    if (!session) {
      toast({ title: "Not logged in", description: "Please log in to check content.", variant: "destructive" });
      return;
    }

    setIsChecking(true);
    setReport(null);

    try {
      // Create a check record first
      const { data: check, error: insertError } = await supabase
        .from("plagiarism_checks")
        .insert({
          user_id: session.user.id,
          title: text.slice(0, 50).trim() + (text.length > 50 ? "..." : ""),
          word_count: wordCount,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function - use fetch directly for proper error handling
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-plagiarism`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ content: text, checkId: check.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Analysis failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setReport(data.report);
      toast({ title: "Analysis complete", description: "Your plagiarism report is ready." });
    } catch (err: any) {
      console.error("Check error:", err);
      toast({ title: "Analysis failed", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  };

  const handleFileLoad = useCallback(async (file: File) => {
    try {
      const extracted = await extractTextFromFile(file);
      setText(extracted);
      toast({ title: "File loaded", description: `Extracted text from ${file.name}` });
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  }, [handleFileLoad]);

  const riskLevel = !report ? null : report.similarity_score < 15 ? "LOW" : report.similarity_score < 40 ? "MEDIUM" : "HIGH";
  const riskColor = riskLevel === "LOW" ? "text-green-500" : riskLevel === "MEDIUM" ? "text-yellow-500" : "text-red-500";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="h-14 border-b border-border glass flex items-center px-4 justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm hidden sm:inline">Turnitin</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/history"><History className="w-4 h-4 mr-1.5" /> History</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to="/profile"><User className="w-4 h-4 mr-1.5" /> Profile</Link>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card/30">
        <div className="container">
          <Tabs defaultValue="web" className="w-full">
            <TabsList className="bg-transparent h-12 p-0 gap-0">
              <TabsTrigger value="web" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <Globe className="w-4 h-4 mr-2" /> Web Search
              </TabsTrigger>
              <TabsTrigger value="compare" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <FileText className="w-4 h-4 mr-2" /> Text Comparison
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                <Bot className="w-4 h-4 mr-2" /> AI Detection
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`${sidebarOpen ? "w-64" : "w-0"} shrink-0 border-r border-border bg-card/30 overflow-hidden transition-all duration-300 hidden lg:block`}>
          <div className="p-4 space-y-6 w-64">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">Settings</h3>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="super" checked={superSearch} onCheckedChange={(v) => setSuperSearch(v === true)} />
                <Label htmlFor="super" className="text-sm cursor-pointer">Super Search</Label>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="scholar" checked={scholarSearch} onCheckedChange={(v) => setScholarSearch(v === true)} />
                <Label htmlFor="scholar" className="text-sm cursor-pointer">Google Scholar Search</Label>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </aside>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="hidden lg:flex items-center justify-center w-8 shrink-0 border-r border-border bg-card/30 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Center - Text Input */}
        <main className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40 h-9 bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => { setText(""); setReport(null); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <Textarea
            placeholder="Insert text to find plagiarism..."
            className="flex-1 min-h-[200px] bg-secondary/30 border-border resize-none text-sm leading-relaxed focus:glow-border transition-shadow"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* File Upload */}
          <div
            className={`mt-4 border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Drag files here or <span className="text-primary">browse</span></p>
            <p className="text-xs text-muted-foreground/60 mt-1">Supports PDF, DOCX, TXT, RTF, CSV, MD, HTML, JSON</p>
            <input id="file-input" type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.csv,.md,.html,.htm,.xml,.json" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileLoad(file);
            }} />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="tabular-nums">{wordCount} words</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => { setText(""); setReport(null); }}>Clear</Button>
              <Button size="sm" onClick={handleCheck} disabled={!text.trim() || isChecking} className="px-6 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20">
                {isChecking ? "Analyzing..." : "Detect Plagiarism"}
              </Button>
            </div>
          </div>
        </main>

        {/* Right - Report Panel */}
        <aside className="w-80 xl:w-96 shrink-0 border-l border-border bg-card/30 overflow-y-auto hidden md:block">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Report</h3>
              {report && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => generateAIWritingReport(report, text)} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" /> AI Report
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generateSimilarityReport(report, text)} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Similarity
                  </Button>
                </div>
              )}
            </div>

            {isChecking && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">AI is analyzing your content...</p>
                <p className="text-xs text-muted-foreground/60">This may take 10-30 seconds</p>
              </div>
            )}

            {!report && !isChecking && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Search className="w-16 h-16 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Paste your text and click "Detect Plagiarism" to get a detailed report</p>
              </div>
            )}

            {report && !isChecking && (
              <div className="space-y-6 animate-fade-in">
                {/* Score donuts */}
                <div className="flex justify-center gap-4">
                  <SimilarityDonut percent={report.similarity_score} label="Similarity" />
                  <SimilarityDonut percent={report.ai_probability} label="AI Detected" />
                </div>

                <div className="flex justify-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-white">
                      {report.paraphrase_score}%
                    </div>
                    <span className="text-xs text-muted-foreground">Paraphrase</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold text-white">
                      {report.flagged_sections.length}
                    </div>
                    <span className="text-xs text-muted-foreground">Flagged</span>
                  </div>
                </div>

                <div className="text-center">
                  <p className={`text-sm font-bold uppercase tracking-wider ${riskColor}`}>
                    {riskLevel} PLAGIARISM RISK
                  </p>
                </div>

                {/* Summary */}
                <div className="glass rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Summary</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.summary}</p>
                </div>

                {/* Flagged Sections */}
                {report.flagged_sections.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">Flagged Sections</h4>
                    {report.flagged_sections.map((s, i) => (
                      <div key={i} className="glass rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            s.risk === "high" ? "bg-red-500/20 text-red-400" :
                            s.risk === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-green-500/20 text-green-400"
                          }`}>{s.risk}</span>
                          <span className="text-xs text-muted-foreground">{s.reason}</span>
                        </div>
                        <p className="text-xs text-muted-foreground/80 italic">"{s.text.slice(0, 150)}{s.text.length > 150 ? "..." : ""}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {report.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Recommendations</h4>
                    <ul className="space-y-1.5">
                      {report.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
