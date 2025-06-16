import { getLocale } from '@/locales/i18n';
import type { Provider } from '@/types';
import { locales } from '@/locales';

/**
 * Gets the localized provider name from the locale files
 * @param provider The provider object
 * @returns Localized provider name
 */
export function getProviderName(provider: Provider): string {
    const locale = getLocale();
    const localeData = locales[locale];

    // Create a key for the provider in the format "provider_id"
    const providerKey = `provider_${provider.id.replace(/-/g, '_')}`;

    // Get the localized name from the locale file or fall back to the provider ID
    return (localeData as Record<string, string>)[providerKey] || provider.name || provider.id;
}
