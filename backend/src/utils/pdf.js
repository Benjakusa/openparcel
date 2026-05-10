const PDFDocument = require('pdfkit');
const { generateQRDataURL } = require('./qr');

const A6_W = 297.6;
const A6_H = 419.5;
const MARGIN = 20;

async function generateReceipt(parcel, type = 'sender') {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: [A6_W, A6_H], margin: MARGIN });
            const buffers = [];
            doc.on('data', buf => buffers.push(buf));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const CX = A6_W / 2;
            let y = MARGIN;
            const COL_W = Math.floor((A6_W - 2 * MARGIN - 10) / 2);

            doc.rect(0, 0, A6_W, A6_H).fillColor('#fff').fill();
            doc.fillColor('#000');

            // --- HEADER (Top Centered) ---
            doc.font('Helvetica-Bold').fontSize(14).text((parcel.company_name || 'COMPANY').toUpperCase(), MARGIN, y, { align: 'center', width: A6_W - 2 * MARGIN });
            y += 20;

            const companyPhone = parcel.company_phone || parcel.sending_office_phone || '-';
            doc.font('Helvetica').fontSize(8).fillColor('#444');
            doc.text('TEL: ' + companyPhone, MARGIN, y, { align: 'center', width: A6_W - 2 * MARGIN });
            y += 12;

            doc.font('Courier-Bold').fontSize(10).fillColor('#1a1a1a');
            doc.text('Tracking: ' + (parcel.tracking_id || 'PENDING'), MARGIN, y, { align: 'center', width: A6_W - 2 * MARGIN });
            y += 14;

            doc.font('Courier').fontSize(8).fillColor('#555');
            doc.text(new Date(parcel.created_at).toLocaleString(), MARGIN, y, { align: 'center', width: A6_W - 2 * MARGIN });
            y += 12;

            doc.moveTo(MARGIN, y).lineTo(A6_W - MARGIN, y).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 10;

            // --- SENDER / RECEIVER (Side by side) ---
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
            doc.text('SENDER details', MARGIN, y, { width: COL_W, align: 'left' });
            doc.text('RECEIVER details', MARGIN + COL_W + 10, y, { width: COL_W, align: 'left' });
            y += 12;

            const printPair = (textLeft, textRight, font, size, color, spaceAfter = 4) => {
                doc.font(font).fontSize(size).fillColor(color);

                const leftStr = textLeft || '-';
                const rightStr = textRight || '-';

                const h1 = doc.heightOfString(leftStr, { width: COL_W });
                const h2 = doc.heightOfString(rightStr, { width: COL_W });

                doc.text(leftStr, MARGIN, y, { width: COL_W, align: 'left' });
                doc.text(rightStr, MARGIN + COL_W + 10, y, { width: COL_W, align: 'left' });

                y += Math.max(h1, h2) + spaceAfter;
            };

            printPair(parcel.sender_name, parcel.receiver_name, 'Helvetica-Bold', 8, '#222');
            printPair(parcel.sender_phone, parcel.receiver_phone, 'Helvetica', 7, '#555');
            printPair(parcel.sending_office_name, parcel.receiving_office_name, 'Helvetica', 7, '#666', 10);

            doc.moveTo(MARGIN, y).lineTo(A6_W - MARGIN, y).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 10;

            // --- PARCEL DETAILS (Left) / QR CODE (Right) ---
            doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
            doc.text('PARCEL DETAILS', MARGIN, y, { width: COL_W });
            y += 14;

            const qrPayload = {
                id: parcel.tracking_id,
                s_name: parcel.sender_name,
                s_phone: parcel.sender_phone,
                r_name: parcel.receiver_name,
                r_phone: parcel.receiver_phone,
                date: new Date(parcel.created_at).toLocaleDateString(),
                from: parcel.sending_office_name || 'N/A',
                to: parcel.receiving_office_name || 'N/A'
            };

            const qrDataUrl = await generateQRDataURL(qrPayload);
            const qrBase64 = qrDataUrl.split(',')[1];
            const qrBuf = Buffer.from(qrBase64, 'base64');
            const qrSize = 75;
            const qrX = MARGIN + COL_W + 10 + (COL_W - qrSize) / 2;

            // We place the QR code aside, but record its max extent
            const detailsStartY = y;
            doc.image(qrBuf, qrX, detailsStartY, { width: qrSize, height: qrSize });

            const printDetail = (label, value) => {
                const labelStr = label + ':';
                const valStr = value || '-';

                doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#666');
                doc.text(labelStr, MARGIN, y, { width: 45, align: 'left' });

                doc.font('Helvetica-Bold').fillColor('#111');
                const valH = doc.heightOfString(valStr, { width: COL_W - 45 });
                doc.text(valStr, MARGIN + 45, y, { width: COL_W - 45, align: 'left' });

                y += valH + 4;
            };

            printDetail('Weight', parcel.weight_kg ? `${parcel.weight_kg} kg` : '-');
            printDetail('Desc', parcel.notes || 'General Parcel');
            printDetail('Status', parcel.status);
            printDetail('Fee', 'KES ' + (parcel.fee_paid || 0));

            y = Math.max(y, detailsStartY + qrSize + 10);

            doc.moveTo(MARGIN, y).lineTo(A6_W - MARGIN, y).lineWidth(0.5).strokeColor('#ccc').stroke();
            y += 12;

            // --- FOOTER ---
            doc.font('Helvetica-Oblique').fontSize(7).fillColor('#777');
            doc.text('Contact your nearest office for inquiries.', MARGIN, y, { width: A6_W - 2 * MARGIN, align: 'center' });
            y += 10;

            doc.font('Helvetica-Bold').fontSize(6).fillColor('#aaa');
            doc.text('POWERED BY OPENDESK', MARGIN, y, { width: A6_W - 2 * MARGIN, align: 'center', characterSpacing: 1 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateReceipt };
