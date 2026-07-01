const { z } = require('zod');

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password required'),
});

const registerSchema = z.object({
    companyName: z.string().min(2, 'Company name must be at least 2 characters').max(100),
    adminEmail: z.string().email('Invalid email'),
    adminPassword: passwordSchema,
    companyPhone: z.string().min(5).max(20).optional(),
});

const createOfficeSchema = z.object({
    name: z.string().min(1, 'Office name required').max(100),
    address: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
});

const createStaffSchema = z.object({
    email: z.string().email('Invalid email'),
    password: passwordSchema,
    fullName: z.string().min(1, 'Full name required').max(100).optional(),
    phone: z.string().max(20).optional(),
    officeId: z.coerce.number().int().positive('Valid office ID required'),
});

const createParcelSchema = z.object({
    senderName: z.string().min(1, 'Sender name required').max(100),
    senderPhone: z.string().min(5, 'Sender phone required').max(20),
    senderIdNumber: z.string().max(50).optional(),
    receiverName: z.string().min(1, 'Receiver name required').max(100),
    receiverPhone: z.string().min(5, 'Receiver phone required').max(20),
    receivingOfficeId: z.number().int().positive('Receiving office required'),
    weightKg: z.number().positive('Weight must be positive'),
    paymentMethod: z.enum(['cash', 'mpesa']).default('mpesa'),
    notes: z.string().max(500).optional(),
    parcelType: z.enum(['one_time', 'per_kg']).default('one_time'),
    pricingOption: z.string().max(50).optional(),
});

const mpesaConfigSchema = z.object({
    shortcode: z.string().min(1, 'Shortcode required'),
    consumerKey: z.string().min(1, 'Consumer key required'),
    consumerSecret: z.string().min(1, 'Consumer secret required'),
    passkey: z.string().min(1, 'Passkey required'),
    environment: z.enum(['sandbox', 'production']).default('sandbox'),
});

const subscribeSchema = z.object({
    plan: z.enum(['monthly', 'lifetime']),
    phoneNumber: z.string().min(5, 'Phone number required'),
});

const pricingSchema = z.object({
    destinationOfficeId: z.number().int().positive(),
    parcelType: z.enum(['one_time', 'per_kg']),
    optionName: z.string().max(50).optional(),
    price: z.number().nonnegative('Price must be non-negative'),
});

const resetPasswordSchema = z.object({
    password: passwordSchema,
    wipeData: z.boolean().optional(),
});

const scanLookupSchema = z.object({
    trackingId: z.string().min(1, 'Tracking ID required'),
});

const scanActionSchema = z.object({
    trackingId: z.string().min(1, 'Tracking ID required'),
    action: z.enum(['dispatch', 'receive', 'handover']).optional(),
});

const trackPhoneSchema = z.object({
    phone: z.string().min(5, 'Phone required'),
});

module.exports = {
    loginSchema,
    registerSchema,
    createOfficeSchema,
    createStaffSchema,
    createParcelSchema,
    mpesaConfigSchema,
    subscribeSchema,
    pricingSchema,
    resetPasswordSchema,
    scanLookupSchema,
    scanActionSchema,
    trackPhoneSchema,
};
