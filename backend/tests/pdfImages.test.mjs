// Offline unit tests for the byte-level PDF image scanner used by the OCR
// fallback (extractPageImages). Synthetic buffers reproduce the shapes
// real-world exporters emit:
//   - direct /Length (baseline behaviour),
//   - indirect /Length N 0 R, with a longer object number as a decoy,
//   - an unresolvable indirect /Length (length object inside a compressed
//     object stream) falling back to `endstream` scanning,
//   - indirect /Width and /Height references,
//   - a JPEG wrapped in an outer Flate layer (/Filter [/FlateDecode
//     /DCTDecode], as emitted by re-saved/"optimized" scans),
//   - a nested /DecodeParms PNG predictor listed BEFORE /Filter, so a
//     dictionary scan that stops at the first `>>` loses the filter entry,
//   - a multi-row TIFF predictor (differencing restarts at every row).
// No PDF parser, no OCR, and no network are involved: the scanner only
// byte-scans the buffers it is given, so no fixture PDFs are needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

const { extractPageImages } = await import('../pdfExtract.js');

const latin1 = (text) => Buffer.from(text, 'latin1');

// Minimal but structurally plausible JPEG stream (SOI ... EOI).
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from('JFIF', 'latin1'),
  Buffer.from([0xff, 0xd9])
]);

// Wrap a dictionary body and a raw stream into an indirect object, as the
// scanner expects to find it in a real file.
function imageObject(dictBody, streamData) {
  return Buffer.concat([
    latin1(`30 0 obj\n<< ${dictBody} >>\nstream\n`),
    streamData,
    latin1('\nendstream\nendobj\n')
  ]);
}

function pngDimensions(png) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

// The PNG encoder writes filter-0 scanlines; expose the inflated IDAT rows so
// pixel round-trips can be asserted.
function pngScanlines(png) {
  const idatStart = png.indexOf(Buffer.from('IDAT', 'latin1'));
  const idatLength = png.readUInt32BE(idatStart - 4);
  return zlib.inflateSync(png.subarray(idatStart + 4, idatStart + 4 + idatLength));
}

test('direct /Length is read unchanged (baseline behaviour)', () => {
  const buffer = imageObject(
    `/Type /XObject /Subtype /Image /Width 200 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ${JPEG.length}`,
    JPEG
  );
  const images = extractPageImages(buffer);
  assert.equal(images.length, 1);
  assert.equal(images[0].mime, 'image/jpeg');
  assert.deepEqual(images[0].data, JPEG);
});

test('indirect /Length N 0 R is resolved (never satisfied by a longer object number)', () => {
  const buffer = Buffer.concat([
    // Decoy: searching for "10 0 obj" must not match inside "110 0 obj".
    latin1('110 0 obj\n999999\nendobj\n'),
    latin1('10 0 obj\n'),
    latin1(String(JPEG.length)),
    latin1('\nendobj\n'),
    imageObject(
      '/Type /XObject /Subtype /Image /Width 200 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length 10 0 R',
      JPEG
    )
  ]);
  const images = extractPageImages(buffer);
  assert.equal(images.length, 1, 'an indirect /Length must not make the image unreadable');
  assert.equal(images[0].mime, 'image/jpeg');
  assert.deepEqual(images[0].data, JPEG);
});

test('an unresolvable indirect /Length falls back to endstream scanning', () => {
  const buffer = imageObject(
    '/Type /XObject /Subtype /Image /Width 200 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length 99 0 R',
    JPEG
  );
  const images = extractPageImages(buffer);
  assert.equal(images.length, 1);
  assert.equal(images[0].mime, 'image/jpeg');
  assert.deepEqual(images[0].data, JPEG);
});

test('indirect /Width and /Height references are resolved', () => {
  const buffer = Buffer.concat([
    latin1('7 0 obj\n120\nendobj\n'),
    latin1('8 0 obj\n90\nendobj\n'),
    latin1('4 0 obj\n'),
    latin1(String(JPEG.length)),
    latin1('\nendobj\n'),
    imageObject(
      '/Type /XObject /Subtype /Image /Width 7 0 R /Height 8 0 R /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length 4 0 R',
      JPEG
    )
  ]);
  const images = extractPageImages(buffer);
  assert.equal(images.length, 1, 'indirect dimensions must not make the image unreadable');
  assert.equal(images[0].mime, 'image/jpeg');
  assert.deepEqual(images[0].data, JPEG);
});

test('a JPEG wrapped in an outer Flate layer (/Filter [/FlateDecode /DCTDecode]) is unwrapped', () => {
  const wrapped = zlib.deflateSync(JPEG);
  const buffer = imageObject(
    `/Type /XObject /Subtype /Image /Width 200 /Height 300 /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
      `/Filter [/FlateDecode /DCTDecode] /DecodeParms [null << /Quality 60 >>] /Length ${wrapped.length}`,
    wrapped
  );
  const images = extractPageImages(buffer);
  assert.equal(images.length, 1, 'a zlib-wrapped JPEG must not be skipped');
  assert.equal(images[0].mime, 'image/jpeg');
  assert.deepEqual(images[0].data, JPEG);
});

test('a JPEG behind an unsupported wrapper filter is skipped, never misread', () => {
  const buffer = imageObject(
    '/Type /XObject /Subtype /Image /Width 200 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 8 ' +
      `/Filter [/ASCII85Decode /DCTDecode] /Length ${JPEG.length}`,
    JPEG
  );
  assert.equal(extractPageImages(buffer).length, 0);
});

test('nested /DecodeParms PNG predictor (listed before /Filter) is decoded', () => {
  const width = 32;
  const height = 6;
  const raw = Buffer.alloc(width * height);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + 13) & 0xff;

  // Encode with PNG filters: row 0 unfiltered, every later row "Up".
  const stride = width + 1;
  const encoded = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    encoded[y * stride] = y === 0 ? 0 : 2;
    for (let x = 0; x < width; x++) {
      const value = raw[y * width + x];
      const up = y === 0 ? 0 : raw[(y - 1) * width + x];
      encoded[y * stride + 1 + x] = (value - up) & 0xff;
    }
  }
  const compressed = zlib.deflateSync(encoded);
  const buffer = imageObject(
    `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 ` +
      `/DecodeParms << /Predictor 12 /Colors 1 /BitsPerComponent 8 /Columns ${width} >> ` +
      `/Filter /FlateDecode /Length ${compressed.length}`,
    compressed
  );

  const images = extractPageImages(buffer);
  assert.equal(images.length, 1, 'a predicted Flate image must not be skipped');
  assert.equal(images[0].mime, 'image/png');
  assert.deepEqual(pngDimensions(images[0].data), { width, height });
  assert.equal(images[0].data[24], 8); // bit depth
  assert.equal(images[0].data[25], 0); // color type: grayscale

  const rows = pngScanlines(images[0].data);
  assert.equal(rows.length, (width + 1) * height);
  for (let y = 0; y < height; y++) {
    assert.equal(rows[y * (width + 1)], 0, 'PNG encoder must emit filter 0');
    assert.deepEqual(
      rows.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)),
      raw.subarray(y * width, (y + 1) * width),
      `row ${y} must round-trip through the predictor decode`
    );
  }
});

test('TIFF predictor (2) decodes with per-row differencing resets', () => {
  const width = 20;
  const height = 3;
  const raw = Buffer.alloc(width * height);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 11 + 5) & 0xff;

  // Horizontal differencing restarts at each row boundary.
  const encoded = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = x === 0 ? 0 : raw[y * width + x - 1];
      encoded[y * width + x] = (raw[y * width + x] - left) & 0xff;
    }
  }
  const compressed = zlib.deflateSync(encoded);
  const buffer = imageObject(
    `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 ` +
      `/DecodeParms << /Predictor 2 /Colors 1 /BitsPerComponent 8 /Columns ${width} >> ` +
      `/Filter /FlateDecode /Length ${compressed.length}`,
    compressed
  );

  const images = extractPageImages(buffer);
  assert.equal(images.length, 1);
  const rows = pngScanlines(images[0].data);
  for (let y = 0; y < height; y++) {
    assert.deepEqual(
      rows.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)),
      raw.subarray(y * width, (y + 1) * width),
      `row ${y} must round-trip through the TIFF predictor decode`
    );
  }
});
