const { generateParcelId, generateTrackingId } = require('./idgen');

function buildQRData(parcel) {
    return JSON.stringify({
        id: parcel.tracking_id || parcel.id,
        s_name: parcel.sender_name || '',
        s_phone: parcel.sender_phone || '',
        r_name: parcel.receiver_name || '',
        r_phone: parcel.receiver_phone || '',
        date: parcel.created_at ? new Date(parcel.created_at).toLocaleDateString() : '',
        from: parcel.sending_office_name || parcel.sending_office || '',
        to: parcel.receiving_office_name || parcel.receiving_office || '',
    });
}

module.exports = { generateParcelId, generateTrackingId, buildQRData };
