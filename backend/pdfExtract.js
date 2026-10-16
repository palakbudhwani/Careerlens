// Resume PDF text extraction with a bounded, offline OCR fallback.
//
// Fast path: pdf-parse over the whole document (unchanged behaviour for every
// textual PDF). When that yields too little text — scanned/image-only pages,
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
const MAX_OCR_IMAGES = 6;
const MAX_IMAGE_PIXELS = 8_000_000;

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
    return { text: result?.text || '', error: null };
  } catch (err) {
    return { text: '', error: classifyPdfError(err) };
  }
}

// --- Embedded image extraction --------------------------------------------
// Scanned pages embed the page image as an XObject; its stream is located by
// a byte scan, so a damaged xref never blocks extraction.

function findDictEnd(buffer, from) {
  const dictStart = buffer.lastIndexOf('<<', from);
  const dictEnd = buffer.indexOf('>>', from);
  if (dictStart === -1 || dictEnd === -1 || from - dictStart > 8192) return null;
  return { dictStart, dictEnd };
}

function readStreamData(buffer, dictEnd, lengthMatch) {
  const streamIdx = buffer.indexOf('stream', dictEnd);
  if (streamIdx === -1 || streamIdx - dictEnd > 16) return null;
  let dataStart = streamIdx + 6;
  if (buffer[dataStart] === 0x0d) dataStart++;
  if (buffer[dataStart] === 0x0a) dataStart++;
  let dataEnd;
  if (lengthMatch) {
    dataEnd = dataStart + Number.parseInt(lengthMatch[1], 10);
    if (dataEnd > buffer.length) return null;
  } else {
    const endstream = buffer.indexOf('endstream', dataStart);
    if (endstream === -1) return null;
    dataEnd = endstream;
    while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) dataEnd--;
  }
  return buffer.subarray(dataStart, dataEnd);
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

function extractPageImages(buffer) {
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
    const dict = buffer.subarray(dictPos.dictStart, dictPos.dictEnd + 2).toString('latin1');

    const width = dict.match(/\/Width\s+(\d+)/);
    const height = dict.match(/\/Height\s+(\d+)/);
    const bpc = dict.match(/\/BitsPerComponent\s+(\d+)/);
    const lengthMatch = dict.match(/\/Length\s+(\d+)/);
    const data = readStreamData(buffer, dictPos.dictEnd, lengthMatch);
    if (!data || !width || !height) continue;
    const w = Number(width[1]);
    const h = Number(height[1]);
    if (w < 16 || h < 16 || w * h > 64_000_000) continue;

    if (/\/DCTDecode/.test(dict)) {
      // Raw JPEG — feed it to OCR as-is.
      if (data[0] === 0xff && data[1] === 0xd8) images.push({ mime: 'image/jpeg', data: Buffer.from(data) });
      continue;
    }
    if (/\/FlateDecode/.test(dict) && (!bpc || bpc[1] === '8') && !/\/DecodeParms/.test(dict)) {
      const channels = /\/DeviceRGB/.test(dict) ? 3 : /\/DeviceGray/.test(dict) ? 1 : 0;
      if (!channels) continue;
      let samples;
      try {
        samples = zlib.inflateSync(data);
      } catch {
        continue;
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
    // CCITTFaxDecode / JPXDecode / indexed images: not decodable here.
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
  if (pending) {
    try {
      const worker = await pending;
      await worker.terminate();
    } catch {
      // already dead
    }
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
  if (images.length === 0) return { text: '', ran: false };
  // The whole stage runs under one lock and tears the worker down afterwards,
  // so no child process ever outlives the request (tests and idle servers
  // must be able to exit cleanly) and concurrent uploads never share a worker.
  return withOcrLock(async () => {
    const deadline = Date.now() + OCR_TOTAL_BUDGET_MS;
    const parts = [];
    let ran = false;
    try {
      for (const image of images.slice(0, MAX_OCR_IMAGES)) {
        if (Date.now() >= deadline) break;
        try {
          const worker = await withTimeout(
            getOcrWorker(),
            OCR_WORKER_INIT_TIMEOUT_MS,
            new Error('OCR engine failed to start')
          );
          const {
            data: { text }
          } = await withTimeout(
            worker.recognize(image.data),
            OCR_IMAGE_TIMEOUT_MS,
            new Error('OCR timed out')
          );
          ran = true;
          if (text.trim()) parts.push(text.trim());
          if (countWords(parts.join('\n')) >= MIN_TEXT_WORDS) break;
        } catch (err) {
          console.warn(`OCR failed for embedded page image: ${err.message}`);
          break;
        }
      }
    } finally {
      await resetOcrWorker();
    }
    return { text: parts.join('\n\n'), ran };
  });
}

// --- Entry point ------------------------------------------------------------

/**
 * Extract resume text from a PDF buffer.
 * Always resolves: { text, method: 'text'|'ocr'|'none', error: {code,message}|null }.
 * `error` is set only when no usable text could be produced; `method` is
 * 'none' exactly when no words could be extracted at all.
 */
export async function extractResumeText(buffer) {
  const pdfResult = await pdfText(buffer);

  if (!pdfResult.error && countWords(pdfResult.text) >= MIN_TEXT_WORDS) {
    return { text: pdfResult.text, method: 'text', error: null };
  }

  // Scanned/image-only (or pdf-parse failed): try embedded-image OCR.
  let ocrResult = { text: '', ran: false };
  try {
    ocrResult = await ocrExtract(buffer);
  } catch (err) {
    console.warn(`OCR stage failed: ${err.message}`);
  }
  if (countWords(ocrResult.text) >= MIN_TEXT_WORDS) {
    return { text: ocrResult.text, method: 'ocr', error: null };
  }

  if (pdfResult.error) return { text: '', method: 'none', error: pdfResult.error };
  const text = pdfResult.text || ocrResult.text;
  return {
    text,
    method: countWords(text) > 0 ? (ocrResult.ran ? 'ocr' : 'text') : 'none',
    error: ERRORS.no_text
  };
}
