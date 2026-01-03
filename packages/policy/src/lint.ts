export function detectSpammyContent(text: string): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!text) return { flagged: false, reasons };
  if (text.length > 1000) reasons.push("too_long");
  if ((text.match(/https?:\/\//g) || []).length > 3) reasons.push("too_many_links");
  return { flagged: reasons.length > 0, reasons };
}
