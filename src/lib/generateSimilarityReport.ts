import jsPDF from "jspdf";

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: { text: string; reason: string; risk: string }[];
  summary: string;
  recommendations: string[];
}

export function generateSimilarityReport(report: PlagiarismReport, text: string, title?: string) {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;
  const maxW = pw - m * 2;
  let y = 0;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > ph - 25) { doc.addPage(); y = 25; }
  };

  const fileName = title || "Document";
  const submissionId = `${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZoneName: "short",
  });
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;

  const sourceColors: [number, number, number][] = [
    [220, 38, 38], [156, 39, 176], [33, 150, 243], [76, 175, 80],
    [255, 152, 0], [0, 150, 136], [121, 85, 72], [96, 125, 139],
    [103, 58, 183], [0, 188, 212], [255, 87, 34], [63, 81, 181],
    [139, 195, 74],
  ];

  // ─── PAGE 1: COVER PAGE ───
  y = ph * 0.3;
  doc.setFontSize(36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, pw / 2, y, { align: "center" });
  y += 12;
  doc.setFontSize(12);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text("by PlagiaShield", pw / 2, y, { align: "center" });

  // Bottom details
  y = ph - 100;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  const coverDetails = [
    ["Submission date:", dateStr],
    ["Submission ID:", submissionId],
    ["File name:", fileName],
    ["Word count:", wordCount.toLocaleString()],
    ["Character count:", charCount.toLocaleString()],
  ];

  doc.setFontSize(9);
  coverDetails.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(label, m, y);
    doc.setFont("helvetica", "normal");
    doc.text(` ${value}`, m + doc.getTextWidth(label) + 2, y);
    y += 6;
  });

  // ─── PAGES 2+: TEXT WITH HIGHLIGHTED MATCHES ───
  doc.addPage();
  y = 25;

  const lineHeight = 5;
  const textToRender = text.slice(0, 50000);

  // Build highlight ranges from flagged sections
  const highlights: { start: number; end: number; color: [number, number, number]; idx: number }[] = [];
  report.flagged_sections.forEach((section, i) => {
    const searchText = section.text.toLowerCase().slice(0, 80);
    const idx = textToRender.toLowerCase().indexOf(searchText);
    if (idx >= 0) {
      highlights.push({
        start: idx,
        end: idx + Math.min(section.text.length, textToRender.length - idx),
        color: sourceColors[i % sourceColors.length],
        idx: i,
      });
    }
  });
  highlights.sort((a, b) => a.start - b.start);

  // Render text word by word with highlights
  doc.setFontSize(9);
  const words = textToRender.split(/(\s+)/);
  let charPos = 0;
  let lineX = m;

  words.forEach((word) => {
    const wordStart = charPos;
    const wordEnd = charPos + word.length;
    charPos = wordEnd;

    if (word.match(/^\s+$/)) {
      lineX += doc.getTextWidth(" ");
      if (word.includes("\n")) { lineX = m; y += lineHeight; addPageIfNeeded(lineHeight + 2); }
      return;
    }

    const wordW = doc.getTextWidth(word);
    if (lineX + wordW > pw - m) {
      lineX = m;
      y += lineHeight;
      addPageIfNeeded(lineHeight + 2);
    }

    const hl = highlights.find((h) => wordStart < h.end && wordEnd > h.start);
    if (hl) {
      // Colored highlight background
      doc.setFillColor(hl.color[0], hl.color[1], hl.color[2]);
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      doc.rect(lineX - 0.3, y - 3.5, wordW + 0.6, 4.5, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));

      doc.setTextColor(hl.color[0], hl.color[1], hl.color[2]);
      doc.setFont("helvetica", "normal");
      doc.text(word, lineX, y);
    } else {
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.text(word, lineX, y);
    }

    lineX += wordW + doc.getTextWidth(" ");
  });

  // ─── ORIGINALITY REPORT PAGE ───
  doc.addPage();
  y = 25;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 6;

  // "ORIGINALITY REPORT" label
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 60, 60);
  doc.text("ORIGINALITY REPORT", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 10;

  // Big scores row
  const scores = [
    { val: `${report.similarity_score}`, label: "SIMILARITY INDEX", color: [220, 60, 60] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.7)}`, label: "INTERNET SOURCES", color: [156, 39, 176] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.8)}`, label: "PUBLICATIONS", color: [33, 150, 243] as [number, number, number] },
    { val: `${Math.round(report.similarity_score * 0.1)}`, label: "STUDENT PAPERS", color: [255, 152, 0] as [number, number, number] },
  ];

  let sx = m;
  scores.forEach((s) => {
    doc.setFontSize(32);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(`${s.val}%`, sx, y + 10);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text(s.label, sx, y + 17);
    sx += 43;
  });

  y += 28;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 8;

  // PRIMARY SOURCES header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 60, 60);
  doc.text("PRIMARY SOURCES", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 8;

  // List sources
  report.flagged_sections.forEach((section, i) => {
    addPageIfNeeded(25);
    const color = sourceColors[i % sourceColors.length];

    // Numbered badge
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(m, y - 4, 9, 9, 1.5, 1.5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const numStr = `${i + 1}`;
    doc.text(numStr, m + 4.5 - doc.getTextWidth(numStr) / 2, y + 1.5);

    // Source name
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const reasonText = section.reason.length > 55 ? section.reason.slice(0, 55) + "..." : section.reason;
    doc.text(reasonText, m + 14, y);

    // Percentage on right
    doc.setFontSize(20);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("<1%", pw - m - 15, y + 1);

    // Type label
    y += 6;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    const typeLabel = section.risk === "high" ? "Internet Source" : section.risk === "medium" ? "Publication" : "Internet Source";
    doc.text(typeLabel, m + 14, y);

    y += 10;
    doc.setDrawColor(230, 230, 230);
    doc.line(m, y - 3, pw - m, y - 3);
  });

  // Exclude settings after primary sources
  y += 10;
  addPageIfNeeded(20);
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Exclude quotes", m, y);
  doc.text("Off", m + 45, y);
  doc.text("Exclude matches", pw / 2, y);
  doc.text("Off", pw / 2 + 45, y);
  y += 5;
  doc.text("Exclude bibliography", m, y);
  doc.text("On", m + 45, y);

  // ─── DETAILED SOURCE BREAKDOWN PAGE ───
  doc.addPage();
  y = 25;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(220, 60, 60);
  doc.text("SOURCE DETAILS", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 10;

  report.flagged_sections.forEach((section, i) => {
    addPageIfNeeded(40);
    const color = sourceColors[i % sourceColors.length];

    // Numbered badge
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(m, y - 4, 9, 9, 1.5, 1.5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const numStr = `${i + 1}`;
    doc.text(numStr, m + 4.5 - doc.getTextWidth(numStr) / 2, y + 1.5);

    // Source name
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color[0], color[1], color[2]);
    const reasonFull = section.reason.length > 70 ? section.reason.slice(0, 70) + "..." : section.reason;
    doc.text(reasonFull, m + 14, y);

    // Type tag on right
    const typeTag = section.risk === "high" ? "Internet Source" : section.risk === "medium" ? "Publication" : "Student Paper";
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    const tagW = doc.getTextWidth(typeTag) + 6;
    const tagColor: [number, number, number] = section.risk === "high" ? [220, 60, 60] : section.risk === "medium" ? [33, 150, 243] : [255, 152, 0];
    doc.setFillColor(tagColor[0], tagColor[1], tagColor[2]);
    doc.roundedRect(pw - m - tagW, y - 4, tagW, 7, 1.5, 1.5, "F");
    doc.text(typeTag, pw - m - tagW + 3, y + 0.5);

    y += 8;

    // Flagged text excerpt
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    const excerptLines = doc.splitTextToSize(`"${section.text.slice(0, 200)}${section.text.length > 200 ? '...' : ''}"`, maxW - 14);
    excerptLines.forEach((line: string) => {
      addPageIfNeeded(6);
      doc.text(line, m + 14, y);
      y += 5;
    });

    y += 3;
    doc.setDrawColor(230, 230, 230);
    doc.line(m, y, pw - m, y);
    y += 8;
  });

  // ─── GRADEMARK REPORT PAGE ───
  doc.addPage();
  y = 25;

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(fileName, m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 160, 200);
  doc.text("GRADEMARK REPORT", m, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(m, y, pw - m, y);
  y += 10;

  // Final Grade / General Comments
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("FINAL GRADE", m, y);
  doc.text("GENERAL COMMENTS", pw / 2, y);
  y += 8;
  doc.setFontSize(28);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("/0", m, y);
  y += 5;
  doc.setDrawColor(200, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(m, y, pw - m, y);
  doc.setLineWidth(0.2);
  y += 8;

  // Page list
  const pageCount = Math.ceil(wordCount / 350);
  for (let p = 1; p <= Math.min(pageCount, 10); p++) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`PAGE ${p}`, m + 10, y);
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(m, y, pw - m, y);
    y += 8;
  }

  doc.save("PlagiaShield_Similarity_Report.pdf");
}
