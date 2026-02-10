import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Generates a random QR token string.
 */
export function generateQrToken(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Generates a unique 6-character quiz code.
 * Checks against the database to ensure uniqueness.
 * @param connection - The database connection to use for checking uniqueness.
 */
export async function generateUniqueQuizCode(connection: any): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 1, 0
    let code = '';
    let isUnique = false;

    while (!isUnique) {
        // Generate 6 random chars
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Check if code exists
        const [rows] = await connection.query(
            'SELECT 1 FROM assessments WHERE quiz_code = ? LIMIT 1',
            [code]
        );

        if ((rows as RowDataPacket[]).length === 0) {
            isUnique = true;
        }
    }
    return code;
}

/**
 * Builds the access URL for the assessment.
 */
export function buildAccessUrl(quizCode: string, qrToken?: string | null): string {
    const rawBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_VERCEL_URL ||
        process.env.VERCEL_URL ||
        "";

    const resolvedBaseUrl = rawBaseUrl
        ? rawBaseUrl.startsWith("http")
            ? rawBaseUrl
            : `https://${rawBaseUrl}`
        : "http://localhost:3000";

    const normalizedCode = quizCode.trim().toUpperCase();
    const tokenParam = qrToken ? `&token=${encodeURIComponent(qrToken)}` : "";
    return `${resolvedBaseUrl}/PWA?code=${encodeURIComponent(normalizedCode)}${tokenParam}`;
}


/**
 * Generates a Data URL for a QR code containing the given text.
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
    try {
        return await QRCode.toDataURL(text);
    } catch (err) {
        console.error('Error generating QR code', err);
        return '';
    }
}

/**
 * Normalizes question types to snake_case.
 */
export function normalizeQuestionType(type: string): string {
    if (!type) return 'multiple_choice';

    // Specific mappings if needed
    if (type === 'multiple-choice') return 'multiple_choice';
    if (type === 'short-answer') return 'short_answer';
    if (type === 'true-false') return 'true_false';

    // General fallback
    return type.replace(/-/g, '_').toLowerCase();
}
