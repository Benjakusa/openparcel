const {
    loginSchema,
    registerSchema,
    createOfficeSchema,
    createStaffSchema,
    createParcelSchema,
    scanLookupSchema,
    scanActionSchema,
} = require('../utils/schemas');

describe('Validation Schemas', () => {
    describe('loginSchema', () => {
        it('accepts valid login', () => {
            const r = loginSchema.safeParse({ email: 'a@b.com', password: 'secret' });
            expect(r.success).toBe(true);
        });
        it('rejects missing email', () => {
            const r = loginSchema.safeParse({ password: 'secret' });
            expect(r.success).toBe(false);
        });
        it('rejects invalid email', () => {
            const r = loginSchema.safeParse({ email: 'notanemail', password: 'secret' });
            expect(r.success).toBe(false);
        });
    });

    describe('createParcelSchema', () => {
        it('accepts valid parcel', () => {
            const r = createParcelSchema.safeParse({
                senderName: 'Alice', senderPhone: '0712345678',
                receiverName: 'Bob', receiverPhone: '0723456789',
                receivingOfficeId: 1, weightKg: 2.5, paymentMethod: 'cash',
            });
            expect(r.success).toBe(true);
        });
        it('rejects missing required fields', () => {
            const r = createParcelSchema.safeParse({ senderName: 'Alice' });
            expect(r.success).toBe(false);
        });
        it('rejects negative weight', () => {
            const r = createParcelSchema.safeParse({
                senderName: 'Alice', senderPhone: '0712345678',
                receiverName: 'Bob', receiverPhone: '0723456789',
                receivingOfficeId: 1, weightKg: -1, paymentMethod: 'cash',
            });
            expect(r.success).toBe(false);
        });
    });

    describe('scanActionSchema', () => {
        it('accepts valid scan without action', () => {
            const r = scanActionSchema.safeParse({ trackingId: 'ABC123' });
            expect(r.success).toBe(true);
        });
        it('accepts valid scan with action', () => {
            const r = scanActionSchema.safeParse({ trackingId: 'ABC123', action: 'dispatch' });
            expect(r.success).toBe(true);
        });
        it('rejects unknown action', () => {
            const r = scanActionSchema.safeParse({ trackingId: 'ABC123', action: 'destroy' });
            expect(r.success).toBe(false);
        });
    });

    describe('registerSchema', () => {
        it('rejects weak password', () => {
            const r = registerSchema.safeParse({ companyName: 'TestCo', adminEmail: 'a@b.com', adminPassword: 'weak' });
            expect(r.success).toBe(false);
        });
        it('accepts strong password if App password rule not overly strict', () => {
            const r = registerSchema.safeParse({ companyName: 'TestCo', adminEmail: 'a@b.com', adminPassword: 'Strong1@pass' });
            expect(r.success).toBe(true);
        });
    });
});
