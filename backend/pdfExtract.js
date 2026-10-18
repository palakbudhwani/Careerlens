// Resume PDF text extraction with a bounded, offline OCR fallback.
//
// Fast path: pdf-parse over the whole document (unchanged behaviour for every
// textual PDF). When that yields too little text — scanned/image-only pages,
// a mixed text+scan document whose text layer is too thin for its page count,
// or a pdf-parse failure — embedded page images are extracted from the bytes
// and read with tesseract.js (WASM, vendored eng.traineddata, no CDN).
//
// Every stage is bounded: the pdf stage has its own timeout, OCR runs under a
// total time budget with a per-image timeout, and image count/pixel caps keep
// pathological files from exhausting memory. Nothing here ever throws for bad
// input; failures come back as { code, message } for the route to surface.
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import pdf from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MIN_TEXT_WORDS = 10;

const PDF_TEXT_TIMEOUT_MS = 20_000;
const OCR_TOTAL_BUDGET_MS = 45_000;
const OCR_IMAGE_TIMEOUT_MS = 30_000;
const OCR_WORKER_INIT_TIMEOUT_MS = 30_000;
// Cleanup must never be able to hang the request when a worker was already
// unhealthy (init timeout), so it gets its own short bound.
const OCR_WORKER_CLEANUP_TIMEOUT_MS = 5_000;
const MAX_OCR_IMAGES = 6;
const MAX_IMAGE_PIXELS = 8_000_000;
// A text layer this thin for the page count usually means some pages are
// scans; OCR may then SUPPLEMENT the direct text (never replace it). Dense
// text layers always win as-is, so OCR never runs unnecessarily.
const MIXED_MIN_WORDS_PER_PAGE = 25;

const ERRORS = {
  encrypted: {
    code: 'encrypted',
    message: 'This PDF is password-protected. Please upload an unlocked copy of your resume.'
  },
  corrupt: {
    code: 'corrupt',
    message: 'This file could not be read as a PDF. It may be damaged — please re-export or re-save your resume and try again.'
  },
  timeout: {
    code: 'timeout',
    message: 'Processing this PDF took too long. The file may be malformed — please re-export it and try again.'
  },
  no_text: {
    code: 'no_text',
    message: 'No readable text could be found in this PDF, even after OCR. Please upload a clearer scan or a text-based (non-photographed) PDF.'
  },
  ocr_unavailable: {
    code: 'ocr_unavailable',
    message: 'This PDF looks like a scan, but the OCR text reader could not start on this server. Please upload a text-based (non-photographed) PDF, or try again later.'
  },
  ocr_failed: {
    code: 'ocr_failed',
    message: 'This PDF looks like a scan, and OCR could not finish reading it. Please upload a clearer scan or a text-based (non-photographed) PDF.'
  }
};

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function withTimeout(promise, ms, errorLike) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(errorLike instanceof Error ? errorLike : new Error(errorLike)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function classifyPdfError(err) {
  const message = String(err?.message || '');
  const name = String(err?.name || '');
  if (name === 'PasswordException' || /password|encrypted|no password/i.test(message)) {
    return ERRORS.encrypted;
  }
  if (/timed out|timeout/i.test(message)) return ERRORS.timeout;
  return ERRORS.corrupt;
}

async function pdfText(buffer) {
  try {
    const result = await withTimeout(
      pdf(new Uint8Array(buffer)),
      PDF_TEXT_TIMEOUT_MS,
      new Error('PDF text extraction timed out')
    );
    return { text: result?.text || '', numpages: Number(result?.numpages) || 0, error: null };
  } catch (err) {
    return { text: '', numpages: 0, error: classifyPdfError(err) };
  }
}

// --- Embedded image extraction --------------------------------------------
// Scanned pages embed the page image as an XObject; its stream is located by
// a byte scan, so a damaged xref never blocks extraction.

// Byte-level dictionary-end finder. Image dictionaries may contain NESTED
// dictionaries (typically /DecodeParms << /Predictor ... >>), so the first
// `>>` after /Subtype is not necessarily the end of the image dictionary. A
// naive `indexOf('>>')` truncates the dictionary there and silently loses
// /Filter /Length /Width entries — the reason predictor-encoded Flate images
// used to be skipped entirely.
function findDictEnd(buffer, from) {
  const dictStart = buffer.lastIndexOf('<<', from);
  if (dictStart === -1 || from - dictStart > 8192) return null;
  const limit = Math.min(buffer.length - 1, dictStart + 65536);
  let depth = 0;
  let i = dictStart;
  while (i < limit) {
    if (buffer[i] === 0x3c && buffer[i + 1] === 0x3c) {
      depth += 1;
      i += 2;
      continue;
    }
    if (buffer[i] === 0x3e && buffer[i + 1] === 0x3e) {
      depth -= 1;
      i += 2;
      if (depth === 0) return { dictStart, dictEnd: i };
      continue;
    }
    i += 1;
  }
  return null;
}

// Resolve an indirect number reference's value by locating `N 0 obj` and
// reading the first integer token after it. Objects stored inside compressed
// object streams cannot be found this way; callers then fall back to scanning
// for `endstream`.
function resolveIndirectNumber(buffer, objNum) {
  const marker = Buffer.from(`${objNum} 0 obj`, 'latin1');
  let from = 0;
  while (from < buffer.length) {
    const idx = buffer.indexOf(marker, from);
    if (idx === -1) return null;
    from = idx + 1;
    // Reject matches that are part of a longer object number ("110 0 obj"
    // must not match a search for "10 0 obj", and vice versa).
    if (idx > 0 && buffer[idx - 1] >= 0x30 && buffer[idx - 1] <= 0x39) continue;
    let i = idx + marker.length;
    if (i < buffer.length && buffer[i] >= 0x30 && buffer[i] <= 0x39) continue;
    while (i < buffer.length && (buffer[i] === 0x20 || buffer[i] === 0x0a || buffer[i] === 0x0d || buffer[i] === 0x09)) i += 1;
    let digits = '';
    while (i < buffer.length && buffer[i] >= 0x30 && buffer[i] <= 0x39) {
      digits += String.fromCharCode(buffer[i]);
      i += 1;
    }
    if (digits) return Number.parseInt(digits, 10);
  }
  return null;
}

// Read a numeric dictionary entry, resolving indirect references such as
// `/Length 12 0 R`, `/Width 7 0 R`, or `/Height 8 0 R` (common in files
// produced by scanner software and office PDF exporters).
function dictNumber(buffer, dict, key) {
  const match = dict.match(new RegExp(`/${key}\\s+(\\d+)`));
  if (!match) return null;
  const after = dict.slice(match.index + match[0].length);
  if (/^\s+\d+\s+R/.test(after)) return resolveIndirectNumber(buffer, Number(match[1]));
  return Number(match[1]);
}

function readStreamData(buffer, dictEnd, directLength = null) {
  const streamIdx = buffer.indexOf('stream', dictEnd);
  if (streamIdx === -1 || streamIdx - dictEnd > 16) return null;
  let dataStart = streamIdx + 6;
  if (buffer[dataStart] === 0x0d) dataStart++;
  if (buffer[dataStart] === 0x0a) dataStart++;
  let dataEnd;
  if (Number.isInteger(directLength) && directLength > 0) {
    dataEnd = dataStart + directLength;
    if (dataEnd > buffer.length) return null;
  } else {
    // No usable /Length (missing or an indirect object we could not resolve):
    // scan to `endstream`. Image streams are binary, so this is best-effort.
    const endstream = buffer.indexOf('endstream', dataStart);
    if (endstream === -1) return null;
    dataEnd = endstream;
    while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) dataEnd--;
  }
  return buffer.subarray(dataStart, dataEnd);
}

// Names of the stream's /Filter entries in decode order, e.g.
//   /Filter [/FlateDecode /DCTDecode]  ->  ['FlateDecode', 'DCTDecode']
//   /Filter /DCTDecode                 ->  ['DCTDecode']
// Returns [] when /Filter is absent or not written in a recognizable form.
function parseFilterList(dict) {
  const match = dict.match(/\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/);
  if (!match) return [];
  return (match[1].match(/\/[A-Za-z0-9]+/g) || []).map((name) => name.slice(1));
}

// Inline /DecodeParms dictionary, e.g.
//   /DecodeParms << /Predictor 12 /Colors 1 /BitsPerComponent 8 /Columns 1728 >>
// Returns null when absent or not an inline dictionary (indirect references,
// arrays for filter chains) — callers then keep the previous skip behaviour.
function parseDecodeParms(dict) {
  const match = dict.match(/\/DecodeParms\s*<<([\s\S]*?)>>/);
  if (!match) return null;
  const body = match[1];
  const number = (key) => {
    const found = body.match(new RegExp(`/${key}\\s+(\\d+)`));
    return found ? Number(found[1]) : null;
  };
  return {
    predictor: number('Predictor') ?? 1,
    colors: number('Colors') ?? 1,
    bitsPerComponent: number('BitsPerComponent') ?? 8,
    columns: number('Columns')
  };
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

// Undo PNG row filters (Predictor 10-15). Every row starts with a filter-type
// byte; the filters themselves follow the PNG specification.
function unfilterPng(data, columns, colors, bitsPerComponent) {
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bitsPerComponent) / 8));
  const rowBytes = Math.ceil((columns * colors * bitsPerComponent) / 8);
  const stride = rowBytes + 1;
  if (rowBytes <= 0 || data.length < stride || data.length % stride !== 0) return null;
  const rows = data.length / stride;
  const out = Buffer.alloc(rowBytes * rows);
  let prev = Buffer.alloc(rowBytes);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * stride];
    if (filter > 4) return null;
    const start = r * stride + 1;
    const cur = out.subarray(r * rowBytes, (r + 1) * rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const raw = data[start + x];
      const left = x >= bytesPerPixel ? cur[x - bytesPerPixel] : 0;
      const up = prev[x];
      const upLeft = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + ((left + up) >> 1);
      else if (filter === 4) value = raw + paethPredictor(left, up, upLeft);
      cur[x] = value & 0xff;
    }
    prev = cur;
  }
  return out;
}

// Undo TIFF Predictor 2 (8-bit horizontal differencing). The differencing
// restarts at every row (Columns samples), so the accumulator must not run
// across row boundaries.
function unfilterTiff(samples, columns, colors) {
  if (colors < 1 || columns < 1) return samples;
  const rowBytes = columns * colors;
  for (let rowStart = 0; rowStart < samples.length; rowStart += rowBytes) {
    const rowEnd = Math.min(samples.length, rowStart + rowBytes);
    for (let i = rowStart + colors; i < rowEnd; i++) {
      samples[i] = (samples[i] + samples[i - colors]) & 0xff;
    }
  }
  return samples;
}

function crc32(buf) {
  let c;
  if (!crc32.table) {
    crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return chunk;
}

function encodePng(width, height, channels, samples) {
  const colorType = channels === 3 ? 2 : 0;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  const stride = width * channels;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    samples.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function downscale(samples, width, height, channels, factor) {
  const newWidth = Math.max(1, Math.floor(width / factor));
  const newHeight = Math.max(1, Math.floor(height / factor));
  const out = Buffer.alloc(newWidth * newHeight * channels);
  const stride = width * channels;
  for (let y = 0; y < newHeight; y++) {
    const srcRow = Math.min(height - 1, y * factor) * stride;
    for (let x = 0; x < newWidth; x++) {
      const src = srcRow + Math.min(width - 1, x * factor) * channels;
      const dst = (y * newWidth + x) * channels;
      samples.copy(out, dst, src, src + channels);
    }
  }
  return { samples: out, width: newWidth, height: newHeight };
}

export function extractPageImages(buffer) {
  const images = [];
  let from = 0;
  const marker = Buffer.from('/Subtype');
  while (images.length < MAX_OCR_IMAGES * 2) {
    const idx = buffer.indexOf(marker, from);
    if (idx === -1) break;
    from = idx + 1;
    if (!/^\s*\/Image/.test(buffer.subarray(idx + 8, idx + 24).toString('latin1'))) continue;
    const dictPos = findDictEnd(buffer, idx);
    if (!dictPos) continue;
    const dict = buffer.subarray(dictPos.dictStart, dictPos.dictEnd).toString('latin1');

    const w = dictNumber(buffer, dict, 'Width');
    const h = dictNumber(buffer, dict, 'Height');
    const bpc = dictNumber(buffer, dict, 'BitsPerComponent');
    const lengthRef = dict.match(/\/Length\s+(\d+)/);
    let directLength = null;
    if (lengthRef) {
      const after = dict.slice(lengthRef.index + lengthRef[0].length);
      directLength = /^\s+\d+\s+R/.test(after)
        ? resolveIndirectNumber(buffer, Number(lengthRef[1]))
        : Number(lengthRef[1]);
    }
    const data = readStreamData(buffer, dictPos.dictEnd, directLength);
    if (!data || !Number.isFinite(w) || !Number.isFinite(h)) continue;
    if (w < 16 || h < 16 || w * h > 64_000_000) continue;
    // Stencil masks are transparency shapes, not page content.
    if (/\/ImageMask\s+true/.test(dict)) continue;

    if (/\/DCTDecode/.test(dict)) {
      // JPEG payload. Filters decode in the order listed, so outer layers
      // BEFORE /DCTDecode must be undone first — /Filter [/FlateDecode
      // /DCTDecode] is a JPEG inside zlib, common in re-saved/"optimized"
      // scans. Only then can the bytes be handed to OCR as a raw JPEG.
      let jpeg = data;
      const filters = parseFilterList(dict);
      const dctIndex = filters.indexOf('DCTDecode');
      if (dctIndex > 0) {
        for (const name of filters.slice(0, dctIndex)) {
          if (name !== 'FlateDecode') { jpeg = null; break; } // wrapper not supported here: keep the old skip behaviour
          try { jpeg = zlib.inflateSync(jpeg); } catch { jpeg = null; break; }
        }
      }
      if (jpeg && jpeg[0] === 0xff && jpeg[1] === 0xd8) images.push({ mime: 'image/jpeg', data: Buffer.from(jpeg) });
      continue;
    }
    if (/\/FlateDecode/.test(dict) && (bpc === null || bpc === 8)) {
      const channels = /\/DeviceRGB/.test(dict) ? 3 : /\/DeviceGray/.test(dict) ? 1 : 0;
      if (!channels) continue;
      let samples;
      try {
        samples = zlib.inflateSync(data);
      } catch {
        continue;
      }
      const params = parseDecodeParms(dict);
      if (params && params.predictor >= 2) {
        if (params.predictor === 2) {
          if (params.bitsPerComponent !== 8) continue;
          samples = unfilterTiff(samples, params.columns ?? w, params.colors);
        } else {
          const columns = params.columns ?? w;
          const unfiltered = unfilterPng(samples, columns, params.colors, params.bitsPerComponent);
          if (!unfiltered) continue;
          samples = unfiltered;
        }
      }
      if (samples.length !== w * h * channels) continue;
      let rw = w;
      let rh = h;
      if (rw * rh > MAX_IMAGE_PIXELS) {
        const factor = Math.ceil(Math.sqrt((rw * rh) / MAX_IMAGE_PIXELS));
        const scaled = downscale(samples, rw, rh, channels, factor);
        samples = scaled.samples;
        rw = scaled.width;
        rh = scaled.height;
      }
      images.push({ mime: 'image/png', data: encodePng(rw, rh, channels, samples) });
      continue;
    }
    // CCITTFaxDecode / JPXDecode / indexed / 1-bit images: not decodable here.
  }
  return images;
}

// --- OCR --------------------------------------------------------------------

const TESSDATA_DIR = path.join(__dirname, 'tessdata');

let ocrWorkerPromise = null;
let ocrChain = Promise.resolve();

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        langPath: TESSDATA_DIR,
        gzip: true,
        cacheMethod: 'none',
        logger: () => {},
        errorHandler: () => {}
      });
    })().catch((err) => {
      ocrWorkerPromise = null;
      throw err;
    });
  }
  return ocrWorkerPromise;
}

async function resetOcrWorker() {
  const pending = ocrWorkerPromise;
  ocrWorkerPromise = null;
  if (!pending) return;
  try {
    // Bounded teardown: if worker startup itself hung (the init timeout in
    // ocrExtract fired), awaiting it here must not hang the upload request.
    const worker = await withTimeout(
      pending,
      OCR_WORKER_CLEANUP_TIMEOUT_MS,
      new Error('OCR worker cleanup timed out')
    );
    await worker.terminate();
  } catch {
    // already dead or unreachable — never block the request on cleanup
  }
}

// OCR calls are serialized: one tesseract worker processes jobs in order.
function withOcrLock(fn) {
  const run = ocrChain.then(fn, fn);
  ocrChain = run.then(() => {}, () => {});
  return run;
}

async function ocrExtract(buffer) {
  const images = extractPageImages(buffer);
  if (images.length === 0) return { text: '', ran: false, attempted: false, error: null };
  // The whole stage runs under one lock and tears the worker down afterwards,
  // so no child process ever outlives the request (tests and idle servers
  // must be able to exit cleanly) and concurrent uploads never share a worker.
  return withOcrLock(async () => {
    const deadline = Date.now() + OCR_TOTAL_BUDGET_MS;
    const parts = [];
    let ran = false;
    let failed = false;
    try {
      let worker;
      try {
        worker = await withTimeout(
          getOcrWorker(),
          OCR_WORKER_INIT_TIMEOUT_MS,
          new Error('OCR engine failed to start')
        );
      } catch (err) {
        // Dependency/runtime problem: OCR could not run at all. This is a
        // different failure than "OCR ran and found nothing".
        console.warn(`OCR engine failed to start: ${err.message}`);
        return { text: '', ran: false, attempted: true, error: 'unavailable' };
      }
      for (const image of images.slice(0, MAX_OCR_IMAGES)) {
        if (Date.now() >= deadline) break;
        try {
          const recognizePromise = worker.recognize(image.data);
          // The per-image timeout may win this race; still attach a handler so
          // a late rejection from the abandoned job can never crash the process.
          recognizePromise.catch(() => {});
          const {
            data: { text }
          } = await withTimeout(
            recognizePromise,
            OCR_IMAGE_TIMEOUT_MS,
            new Error('OCR timed out')
          );
          ran = true;
          if (text.trim()) parts.push(text.trim());
          if (countWords(parts.join('\n')) >= MIN_TEXT_WORDS) break;
        } catch (err) {
          // One unreadable image must not sink the remaining pages.
          console.warn(`OCR failed for embedded page image: ${err.message}`);
          failed = true;
        }
      }
    } finally {
      await resetOcrWorker();
    }
    if (!ran && failed) return { text: '', ran: false, attempted: true, error: 'failed' };
    return { text: parts.join('\n\n'), ran, attempted: true, error: null };
  });
}

// --- Entry point ------------------------------------------------------------

/**
 * Extract resume text from a PDF buffer.
 * Always resolves: { text, method: 'text'|'ocr'|'none', error: {code,message}|null }.
 * `error` is set only when no usable text could be produced; `method` is
 * 'none' exactly when no words could be extracted at all.
 *
 * Direct text extraction is authoritative whenever it is dense enough. OCR
 * runs for image-only documents, when pdf-parse failed, and for mixed
 * documents whose text layer is too thin for their page count — there it
 * SUPPLEMENTS the direct text (direct text first, OCR parts appended in
 * stream order) and can never replace or discard it.
 */
export async function extractResumeText(buffer) {
  const pdfResult = await pdfText(buffer);
  const directWords = countWords(pdfResult.text);
  const numPages = pdfResult.numpages > 0 ? pdfResult.numpages : 1;
  const directTextIsThin = directWords >= MIN_TEXT_WORDS && directWords < MIXED_MIN_WORDS_PER_PAGE * numPages;

  if (!pdfResult.error && directWords >= MIN_TEXT_WORDS && !directTextIsThin) {
    return { text: pdfResult.text, method: 'text', error: null };
  }

  // Scanned/image-only, mixed text+scan, or pdf-parse failed: read the
  // embedded page images with OCR.
  let ocrResult = { text: '', ran: false, attempted: false, error: null };
  try {
    ocrResult = await ocrExtract(buffer);
  } catch (err) {
    console.warn(`OCR stage failed: ${err.message}`);
    ocrResult = { text: '', ran: false, attempted: false, error: 'failed' };
  }
  const ocrWords = countWords(ocrResult.text);

  // Mixed document: the direct text is usable on its own, but OCR recovered
  // additional content from scanned pages — keep both, never substitute.
  if (directWords >= MIN_TEXT_WORDS) {
    if (ocrWords >= MIN_TEXT_WORDS) {
      return {
        text: `${pdfResult.text.trim()}\n\n${ocrResult.text}`.trim(),
        method: 'ocr',
        error: null
      };
    }
    return { text: pdfResult.text, method: 'text', error: null };
  }

  if (ocrWords >= MIN_TEXT_WORDS) {
    return { text: ocrResult.text, method: 'ocr', error: null };
  }

  if (pdfResult.error) return { text: '', method: 'none', error: pdfResult.error };
  // The file contains page images, OCR was attempted, but no single image was
  // ever read: report why instead of claiming "no readable text after OCR".
  if (ocrResult.attempted && !ocrResult.ran && ocrResult.error) {
    return {
      text: '',
      method: 'none',
      error: ocrResult.error === 'unavailable' ? ERRORS.ocr_unavailable : ERRORS.ocr_failed
    };
  }
  const text = pdfResult.text || ocrResult.text;
  return {
    text,
    method: countWords(text) > 0 ? (ocrResult.ran ? 'ocr' : 'text') : 'none',
    error: ERRORS.no_text
  };
}
