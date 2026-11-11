import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';

/** Texto de um PDF, em memória. O arquivo nunca é gravado (RN-067: o currículo é dado sensível). */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text, pages: totalPages };
}
