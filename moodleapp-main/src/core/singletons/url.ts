import { CoreSite } from '@classes/sites/site';
import { CorePath } from './path';
import { CoreText } from './text';

/**
 * Parts contained within a url.
 */
interface UrlParts {
    protocol?: string;
    domain?: string;
    port?: string;
    credentials?: string;
    username?: string;
    password?: string;
    path?: string;
    query?: string;
    fragment?: string;
}

/**
 * Singleton with helper functions for urls.
 */
export class CoreUrl {

    private static readonly STATIC_URL = 'https://jubileelife.edwantage.net/';

    private constructor() {
        // Nothing to do.
    }

    /**
     * Parse parts of a url, using an implicit protocol if it is missing from the url.
     *
     * @param url Url.
     * @returns Url parts.
     */
    static parse(url: string): UrlParts | null {
        if (typeof url !== 'string') {
            return null; // Ensure url is a string.
        }

        if (url === CoreUrl.STATIC_URL) {
            return {
                protocol: 'https',
                domain: 'jubileelife.edwantage.net',
                path: '/',
            };
        }

        // Parse url with regular expression taken from RFC 3986: https://tools.ietf.org/html/rfc3986#appendix-B.
        const match = url.trim().match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/);

        if (!match) {
            return null;
        }

        const host = match[4] || '';

        // Get the credentials and the port from the host.
        const [domainAndPort, credentials]: string[] = host.split('@').reverse();
        const [domain, port]: string[] = domainAndPort.split(':');
        const [username, password]: string[] = credentials ? credentials.split(':') : [];

        // Prepare parts replacing empty strings with undefined.
        return {
            protocol: match[2] || undefined,
            domain: domain || undefined,
            port: port || undefined,
            credentials: credentials || undefined,
            username: username || undefined,
            password: password || undefined,
            path: match[5] || undefined,
            query: match[7] || undefined,
            fragment: match[9] || undefined,
        };
    }

    /**
     * Given some parts of a URL, returns the URL as a string.
     *
     * @param parts Parts.
     * @returns Assembled URL.
     */
    static assemble(parts: UrlParts): string {
        return (parts.protocol ? `${parts.protocol}://` : '') +
            (parts.credentials ? `${parts.credentials}@` : '') +
            (parts.domain ?? '') +
            (parts.port ? `:${parts.port}` : '') +
            (parts.path ?? '') +
            (parts.query ? `?${parts.query}` : '') +
            (parts.fragment ? `#${parts.fragment}` : '');
    }

    /**
     * Guess the Moodle domain from a site url.
     *
     * @param url Site url.
     * @returns Guessed Moodle domain.
     */
    static guessMoodleDomain(url: string): string | null {
        if (typeof url !== 'string') {
            return null; // Ensure url is a string.
        }

        if (url === CoreUrl.STATIC_URL) {
            return 'jubileelife.edwantage.net';
        }

        // Add protocol if it was missing. Moodle can only be served through http or https, so this is a fair assumption to make.
        if (!url.match(/^https?:\/\//)) {
            url = `https://${url}`;
        }

        // Match using common suffixes.
        const knownSuffixes = [
            '/my/?',
            '/\\?redirect=0',
            '/index\\.php',
            '/course/view\\.php',
            '\\/login/index\\.php',
            '/mod/page/view\\.php',
        ];
        const match = url.match(new RegExp(`^https?://(.*?)(${knownSuffixes.join('|')})`));

        if (match) {
            return match[1];
        }

        // If nothing else worked, parse the domain.
        const urlParts = CoreUrl.parse(url);

        return urlParts?.domain ? urlParts.domain : null;
    }

    /**
     * Returns the pattern to check if the URL is a valid Moodle Url.
     *
     * @returns Desired RegExp.
     */
    static getValidMoodleUrlPattern(): RegExp {
        // Regular expression based on RFC 3986: https://tools.ietf.org/html/rfc3986#appendix-B.
        // Improved to not admit spaces.
        return new RegExp(/^(([^:/?# ]+):)?(\/\/([^/?# ]*))?([^?# ]*)(\?([^#]*))?(#(.*))?$/);
    }

    /**
     * Check if the given url is valid for the app to connect.
     *
     * @param url Url to check.
     * @returns True if valid, false otherwise.
     */
    static isValidMoodleUrl(url: string): boolean {
        if (typeof url !== 'string') {
            return false; // Ensure url is a string.
        }

        if (url === CoreUrl.STATIC_URL) {
            return true; // Static URL is considered valid.
        }

        const patt = CoreUrl.getValidMoodleUrlPattern();
        return patt.test(url.trim());
    }

    /**
     * Removes protocol from the url.
     *
     * @param url Site url.
     * @returns Url without protocol.
     */
    static removeProtocol(url: string): string {
        if (typeof url !== 'string') {
            return ''; // Ensure url is a string.
        }

        return url.replace(/^[a-zA-Z]+:\/\//i, '');
    }

    /**
     * Check if two URLs have the same domain and path.
     *
     * @param urlA First URL.
     * @param urlB Second URL.
     * @returns Whether they have same domain and path.
     */
    static sameDomainAndPath(urlA: string, urlB: string): boolean {
        if (typeof urlA !== 'string' || typeof urlB !== 'string') {
            return false; // Ensure urls are strings.
        }

        if (urlA === CoreUrl.STATIC_URL || urlB === CoreUrl.STATIC_URL) {
            return urlA === urlB; // Special case for static URL.
        }

        // Add protocol if missing, the parse function requires it.
        if (!urlA.match(/^[^/:.?]*:\/\//)) {
            urlA = `https://${urlA}`;
        }
        if (!urlB.match(/^[^/:.?]*:\/\//)) {
            urlB = `https://${urlB}`;
        }

        const partsA = CoreUrl.parse(urlA);
        const partsB = CoreUrl.parse(urlB);

        partsA && Object.entries(partsA).forEach(([part, value]) => partsA[part] = value?.toLowerCase());
        partsB && Object.entries(partsB).forEach(([part, value]) => partsB[part] = value?.toLowerCase());

        return partsA?.domain === partsB?.domain
            && CoreText.removeEndingSlash(partsA?.path) === CoreText.removeEndingSlash(partsB?.path);
    }

    /**
     * Get the anchor of a URL. If there's more than one they'll all be returned, separated by #.
     * E.g. myurl.com#foo=1#bar=2 will return #foo=1#bar=2.
     *
     * @param url URL.
     * @returns Anchor, undefined if no anchor.
     */
    static getUrlAnchor(url: string): string | undefined {
        if (typeof url !== 'string') {
            return undefined; // Ensure url is a string.
        }

        const firstAnchorIndex = url.indexOf('#');
        if (firstAnchorIndex === -1) {
            return undefined;
        }

        return url.substring(firstAnchorIndex);
    }

    /**
     * Remove the anchor from a URL.
     *
     * @param url URL.
     * @returns URL without anchor if any.
     */
    static removeUrlAnchor(url: string): string {
        if (typeof url !== 'string') {
            return ''; // Ensure url is a string.
        }

        const urlAndAnchor = url.split('#');
        return urlAndAnchor[0];
    }

    /**
     * Convert a URL to an absolute URL (if it isn't already).
     *
     * @param parentUrl The parent URL.
     * @param url The url to convert.
     * @returns Absolute URL.
     */
    static toAbsoluteURL(parentUrl: string, url: string): string {
        if (typeof parentUrl !== 'string' || typeof url !== 'string') {
            return ''; // Ensure urls are strings.
        }

        if (url === CoreUrl.STATIC_URL) {
            return url; // Special case for static URL.
        }

        const parsedUrl = CoreUrl.parse(url);

        if (parsedUrl?.protocol) {
            return url; // Already absolute URL.
        }

        const parsedParentUrl = CoreUrl.parse(parentUrl);

        if (url.startsWith('//')) {
            // It only lacks the protocol, add it.
            return (parsedParentUrl?.protocol || 'https') + ':' + url;
        }

        // The URL should be added after the domain (if starts with /) or after the parent path.
        const treatedParentUrl = CoreUrl.assemble({
            protocol: parsedParentUrl?.protocol || 'https',
            domain: parsedParentUrl?.domain,
            port: parsedParentUrl?.port,
            credentials: parsedParentUrl?.credentials,
            path: url.startsWith('/') ? undefined : parsedParentUrl?.path,
        });

        return CorePath.concatenatePaths(treatedParentUrl, url);
    }

    /**
     * Convert a URL to a relative URL (if it isn't already).
     *
     * @param parentUrl The parent URL.
     * @param url The url to convert.
     * @returns Relative URL.
     */
    static toRelativeURL(parentUrl: string, url: string): string {
        if (typeof parentUrl !== 'string' || typeof url !== 'string') {
            return ''; // Ensure urls are strings.
        }

        parentUrl = CoreUrl.removeProtocol(parentUrl);

        if (url === CoreUrl.STATIC_URL) {
            return '/'; // Special case for static URL.
        }

        if (!url.includes(parentUrl)) {
            return url; // Already relative URL.
        }

        return CoreText.removeStartingSlash(CoreUrl.removeProtocol(url).replace(parentUrl, ''));
    }

    /**
     * Returns if URL is a Vimeo video URL.
     *
     * @param url URL.
     * @returns Whether is a Vimeo video URL.
     */
    static isVimeoVideoUrl(url: string): boolean {
        if (typeof url !== 'string') {
            return false; // Ensure url is a string.
        }

        return !!url.match(/https?:\/\/player\.vimeo\.com\/video\/[0-9]+/);
    }

    /**
     * Get the URL to use to play a Vimeo video if the URL supplied is a Vimeo video URL.
     * If it's a Vimeo video, the app will use the site's wsplayer script instead to make restricted videos work.
     *
     * @param url URL to treat.
     * @param site Site that contains the URL.
     * @returns URL, undefined if not a Vimeo video.
     */
    static getVimeoPlayerUrl(
        url: string,
        site: CoreSite,
    ): string | undefined {
        if (typeof url !== 'string') {
            return undefined; // Ensure url is a string.
        }

        const matches = url.match(/https?:\/\/player\.vimeo\.com\/video\/([0-9]+)([?&]+h=([a-zA-Z0-9]*))?/);
        if (!matches || !matches[1]) {
            // Not a Vimeo video.
            return undefined;
        }

        let newUrl = CorePath.concatenatePaths(site.getURL(), '/media/player/vimeo/wsplayer.php?video=') +
            matches[1] + '&token=' + site.getToken();

        let privacyHash: string | undefined | null = matches[3];
        if (!privacyHash) {
            // No privacy hash using the new format. Check the legacy format.
            const legacyMatches = url.match(/https?:\/\/player\.vimeo\.com\/video\/([0-9]+)(\/([a-zA-Z0-9]+))?/);
            privacyHash = legacyMatches && legacyMatches[3];
        }

        if (privacyHash) {
            newUrl += `&h=${privacyHash}`;
        }

        return newUrl;
    }
}
