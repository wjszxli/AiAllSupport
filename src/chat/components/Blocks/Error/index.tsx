import { ErrorMessageBlock } from '@/types/messageBlock';
import { t } from '@/locales/i18n';

export default function ErrorBlock({ part }: { part: ErrorMessageBlock }) {
    const HTTP_ERROR_CODES = [400, 401, 403, 404, 429, 500, 502, 503, 504];

    // Get error messages for specific HTTP status codes using translations
    const getErrorMessage = (code: number): string => {
        const errorKey = `error${code}`;
        return t(errorKey);
    };

    // Get the error code or undefined
    const errorCode = part.error?.code || part.error?.status || undefined;

    // Determine if the error code is in our HTTP_ERROR_CODES list
    const isKnownHttpError = errorCode !== undefined && HTTP_ERROR_CODES.includes(errorCode);

    // Get the appropriate error message
    const errorMessage = isKnownHttpError
        ? getErrorMessage(errorCode)
        : part.error?.message || t('errorDefault');

    return (
        <div
            key={part.id}
            className="error-block"
            style={{
                backgroundColor: '#ffeef0',
                border: '1px solid #fbb',
                borderRadius: '6px',
                padding: '12px',
                margin: '8px 0',
                color: '#d73a49',
            }}
        >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {part.error?.name || t('httpError')}
                {errorCode !== undefined && ` (${errorCode})`}
            </div>
            <div>{errorMessage}</div>
        </div>
    );
}
