import { writeFileSync } from 'node:fs';

const obj1 = '<< /Type /Catalog /Pages 2 0 R >>';
const obj2 = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
const obj3 = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>';

let data = '%PDF-1.4\n';
const off1 = data.length; data += `1 0 obj\n${obj1}\nendobj\n`;
const off2 = data.length; data += `2 0 obj\n${obj2}\nendobj\n`;
const off3 = data.length; data += `3 0 obj\n${obj3}\nendobj\n`;

const xrefPos = data.length;
data += 'xref\n0 4\n';
const pad = (n, len) => String(n).padStart(10, '0');
data += `${pad(0,10)} 65535 f \n`;
data += `${pad(off2,10)} 00000 n \n`;
data += `${pad(off1,10)} 00000 n \n`;
data += `${pad(off3,10)} 00000 n \n`;
data += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

writeFileSync('C:/Users/JK/AppData/Local/Temp/opencode/bad-xref.pdf', Buffer.from(data, 'latin1'));
console.log('wrote bad-xref.pdf', Buffer.byteLength(data, 'latin1'));
