import jsPDF from "jspdf";

interface PlagiarismReport {
  similarity_score: number;
  paraphrase_score: number;
  ai_probability: number;
  flagged_sections: { text: string; reason: string; risk: string }[];
  summary: string;
  recommendations: string[];
}

export function generateAIWritingReport(report: PlagiarismReport, text: string, title?: string) {
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
  const submissionId = `trn:oid:::${Date.now()}`;
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;
  const pageCount = Math.ceil(wordCount / 350);

  // ─── HEADER/FOOTER HELPER ───
  const drawHeader = (pageNum: number, totalPages: number, sectionName: string) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, 18, "F");
    // Logo area
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 60, 80);
    doc.text("PlagiaShield", m, 12);
    // Page info
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, m + 50, 12);
    // Submission ID
    doc.text(`Submission ID   ${submissionId}`, pw - m - 60, 12);
    // Line under header
    doc.setDrawColor(220, 220, 220);
    doc.line(m, 16, pw - m, 16);
  };

  const drawFooter = (pageNum: number, totalPages: number, sectionName: string) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("PlagiaShield", m, ph - 10);
    doc.text(`Page ${pageNum} of ${totalPages} - ${sectionName}`, m + 40, ph - 10);
    doc.text(`Submission ID   ${submissionId}`, pw - m - 60, ph - 10);
  };

  // ─── PAGE 1: COVER PAGE ───
  y = ph * 0.38;
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(fileName, m, y);
  y += 14;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Quick Submit", m + 8, y);
  y += 8;
  doc.text("Quick Submit", m + 8, y);
  y += 20;

  // Document Details section
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Document Details", m, y);
  y += 12;

  // Details left column
  const detailPairs = [
    ["Submission ID", submissionId],
    ["Submission Date", dateStr],
    ["Download Date", dateStr],
    ["File Name", fileName],
  ];

  doc.setFontSize(8);
  detailPairs.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(label, m, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(value, m, y);
    y += 10;
  });

  // Stats box on right
  const boxX = pw - m - 55;
  const boxY = y - 55;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(boxX, boxY, 55, 40, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(`${pageCount} Pages`, boxX + 8, boxY + 12);
  doc.text(`${wordCount.toLocaleString()} Words`, boxX + 8, boxY + 22);
  doc.text(`${charCount.toLocaleString()} Characters`, boxX + 8, boxY + 32);

  // ─── PAGE 2: AI WRITING OVERVIEW ───
  doc.addPage();
  y = 25;

  // Light blue box
  doc.setFillColor(235, 245, 252);
  doc.roundedRect(m, y, maxW, 55, 3, 3, "F");

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text(`${report.ai_probability}% detected as AI`, m + 8, y + 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const aiDesc = "AI detection includes the possibility of false positives. Although some text in this submission is likely AI generated, scores below the 20% threshold are not surfaced because they have a higher likelihood of false positives.";
  const aiLines = doc.splitTextToSize(aiDesc, maxW / 2 - 12);
  aiLines.forEach((line: string, i: number) => {
    doc.text(line, m + 8, y + 26 + i * 4);
  });

  // Caution box on right
  const cautionX = m + maxW / 2 + 5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cautionX, y + 5, maxW / 2 - 13, 45, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Caution: Review required.", cautionX + 5, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const cautionText = "It is essential to understand the limitations of AI detection before making decisions about a student's work.";
  const cautionLines = doc.splitTextToSize(cautionText, maxW / 2 - 25);
  cautionLines.forEach((line: string, i: number) => {
    doc.text(line, cautionX + 5, y + 22 + i * 4);
  });

  y += 65;

  // Disclaimer
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Disclaimer", m, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const disclaimer = "Our AI writing assessment is designed to help educators identify text that might be prepared by a generative AI tool. Our AI writing assessment may not always be accurate (i.e., our AI models may produce either false positive results or false negative results), so it should not be used as the sole basis for adverse actions against a student.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, maxW);
  disclaimerLines.forEach((line: string) => {
    doc.text(line, m, y);
    y += 3.5;
  });

  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(m, y, pw - m, y);
  y += 10;

  // FAQ
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Frequently Asked Questions", m, y);
  y += 10;

  const faqs = [
    {
      q: "How should I interpret the AI writing percentage and false positives?",
      a: "The percentage shown in the AI writing report is the amount of qualifying text within the submission that the AI writing detection model determines was either likely AI-generated text from a large-language model or likely AI-generated text that was likely revised using an AI paraphrase tool or word spinner."
    },
    {
      q: "What does 'qualifying text' mean?",
      a: "Our model only processes qualifying text in the form of long-form writing. Long-form writing means individual sentences contained in paragraphs that make up a longer piece of written work, such as an essay, a dissertation, or an article."
    }
  ];

  faqs.forEach((faq) => {
    addPageIfNeeded(30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(faq.q, m, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const aLines = doc.splitTextToSize(faq.a, maxW);
    aLines.forEach((line: string) => {
      addPageIfNeeded(5);
      doc.text(line, m, y);
      y += 3.8;
    });
    y += 6;
  });

  // ─── PAGE 3+: AI WRITING SUBMISSION (full text) ───
  doc.addPage();
  y = 25;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const lineHeight = 5;
  const textToRender = text.slice(0, 50000);
  const allLines = doc.splitTextToSize(textToRender, maxW);

  allLines.forEach((line: string) => {
    addPageIfNeeded(lineHeight + 2);
    doc.text(line, m, y);
    y += lineHeight;
  });

  // ─── APPLY HEADERS/FOOTERS ───
  const totalPages = doc.getNumberOfPages();
  const sections = ["Cover Page", "AI Writing Overview"];
  // Pages 3+ are AI Writing Submission
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const section = p === 1 ? "Cover Page" : p === 2 ? "AI Writing Overview" : "AI Writing Submission";
    drawHeader(p, totalPages, section);
    drawFooter(p, totalPages, section);
  }

  doc.save("PlagiaShield_AI_Writing_Report.pdf");
}
