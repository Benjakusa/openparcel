import { CheckCircle, XCircle } from 'lucide-react';

const RULES = [
    { key: 'minLen', label: 'At least 8 characters', test: p => p.length >= 8 },
    { key: 'upper', label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
    { key: 'lower', label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
    { key: 'number', label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
    { key: 'special', label: 'One special character', test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function PasswordStrength({ password = '' }) {
    const allMet = RULES.every(r => r.test(password));

    return (
        <div className="space-y-1.5 mt-2">
            {RULES.map(rule => {
                const met = rule.test(password);
                return (
                    <div key={rule.key} className={`flex items-center gap-2 text-xs font-normal transition-colors ${met ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {met ? <CheckCircle size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
                        <span>{rule.label}</span>
                    </div>
                );
            })}
            {password.length > 0 && allMet && (
                <div className="text-xs font-normal text-emerald-600 mt-1.5 pt-1.5 border-t border-emerald-200">Strong password</div>
            )}
        </div>
    );
}
