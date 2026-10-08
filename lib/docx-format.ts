import { unzipSync } from "fflate";

type CountMap = Record<string, number>;

function bump(map: CountMap, value?: string) {
  const key = value?.trim();
  if (key) map[key] = (map[key] ?? 0) + 1;
}

function topEntries(map: CountMap, limit = 12) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function twipsToCm(value?: string) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number / 567) * 100) / 100 : null;
}

export function inspectDocx(buffer: ArrayBuffer) {
  try {
    const files = unzipSync(new Uint8Array(buffer));
    const decoder = new TextDecoder();
    const documentXml = files["word/document.xml"] ? decoder.decode(files["word/document.xml"]) : "";
    const stylesXml = files["word/styles.xml"] ? decoder.decode(files["word/styles.xml"]) : "";
    if (!documentXml) return { available: false, reason: "DOCX 中未找到正文 XML" };

    const fonts: CountMap = {};
    const sizes: CountMap = {};
    const paragraphStyles: CountMap = {};
    const alignments: CountMap = {};
    const styleNames: Record<string, string> = {};

    for (const match of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
      const name = match[2].match(/<w:name\b[^>]*w:val="([^"]+)"/i)?.[1];
      if (name) styleNames[match[1]] = name;
    }
    for (const match of documentXml.matchAll(/<w:rFonts\b[^>]*>/g)) {
      const tag = match[0];
      bump(fonts, tag.match(/w:eastAsia="([^"]+)"/)?.[1] ?? tag.match(/w:ascii="([^"]+)"/)?.[1] ?? tag.match(/w:hAnsi="([^"]+)"/)?.[1]);
    }
    for (const match of documentXml.matchAll(/<w:sz\b[^>]*w:val="([^"]+)"/g)) {
      const halfPoints = Number(match[1]);
      bump(sizes, Number.isFinite(halfPoints) ? `${halfPoints / 2}pt` : match[1]);
    }
    for (const match of documentXml.matchAll(/<w:pStyle\b[^>]*w:val="([^"]+)"/g)) {
      bump(paragraphStyles, styleNames[match[1]] ?? match[1]);
    }
    for (const match of documentXml.matchAll(/<w:jc\b[^>]*w:val="([^"]+)"/g)) bump(alignments, match[1]);

    const section = documentXml.match(/<w:sectPr\b[^>]*>([\s\S]*?)<\/w:sectPr>/)?.[1] ?? "";
    const pageSize = section.match(/<w:pgSz\b[^>]*w:w="([^"]+)"[^>]*w:h="([^"]+)"/);
    const margins = section.match(/<w:pgMar\b[^>]*w:top="([^"]+)"[^>]*w:right="([^"]+)"[^>]*w:bottom="([^"]+)"[^>]*w:left="([^"]+)"/);
    const paragraphs = (documentXml.match(/<w:p(?:\s|>)/g) ?? []).length;
    const tables = (documentXml.match(/<w:tbl(?:\s|>)/g) ?? []).length;
    const images = Object.keys(files).filter((name) => name.startsWith("word/media/")).length;
    const headers = Object.keys(files).filter((name) => /^word\/header\d+\.xml$/.test(name)).length;
    const footers = Object.keys(files).filter((name) => /^word\/footer\d+\.xml$/.test(name)).length;

    return {
      available: true,
      paragraphs,
      tables,
      images,
      headers,
      footers,
      fonts: topEntries(fonts),
      fontSizes: topEntries(sizes),
      paragraphStyles: topEntries(paragraphStyles),
      alignments: topEntries(alignments),
      page: {
        widthCm: twipsToCm(pageSize?.[1]),
        heightCm: twipsToCm(pageSize?.[2]),
        marginsCm: margins ? { top: twipsToCm(margins[1]), right: twipsToCm(margins[2]), bottom: twipsToCm(margins[3]), left: twipsToCm(margins[4]) } : null,
      },
    };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : "DOCX 解析失败" };
  }
}
