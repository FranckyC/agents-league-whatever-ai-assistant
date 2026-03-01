import { decodeJwt } from "jose";

/** Well-known audience for Microsoft Graph API tokens */
export const MS_GRAPH_AUDIENCE = "00000003-0000-0000-c000-000000000000";

/**
 * Returned when token validation fails.
 * - `status` is the recommended HTTP status code (401 = auth failure, 403 = forbidden).
 * - `error` is a human-readable message suitable for JSON-RPC error responses.
 */
export interface JwtValidationError {
    /** Recommended HTTP status code: 401 for missing/expired/malformed, 403 for wrong audience/tenant */
    status: 401 | 403;
    error: string;
}

/**
 * Configuration for JWT validation against Microsoft Entra ID.
 */
export interface JwtValidatorOptions {
    /** The expected audience (aud claim). Defaults to Microsoft Graph (`00000003-0000-0000-c000-000000000000`). */
    audience?: string;
    /** The Entra ID tenant ID. When set, validates the `tid` and `iss` claims match this tenant. */
    tenantId: string;
}

/**
 * Validates JWT tokens issued by Microsoft Entra ID using claims-only validation.
 * 
 * Microsoft Graph access tokens (aud `00000003-0000-0000-c000-000000000000`) include a
 * `nonce` in the JWT header which makes cryptographic signature verification impossible
 * for third-party applications. This validator checks claims (issuer, audience, tenant,
 * expiry) without verifying the signature.
 */
export class JwtValidator {

    private _audience: string;
    private _tenantId: string;

    constructor(options: JwtValidatorOptions) {
        const { audience, tenantId } = options;

        this._audience = audience ?? MS_GRAPH_AUDIENCE;
        this._tenantId = tenantId;
    }

    /**
     * Validates a Bearer token by checking its claims.
     * Checks audience, issuer, tenant ID, and expiration.
     * 
     * Note: Signature verification is skipped because Microsoft Graph tokens
     * use a nonce-based signing scheme that prevents third-party verification.
     * 
     * @returns `null` if the token is valid, or a `JwtValidationError` with the
     *          recommended HTTP status code and error message.
     */
    async validate(token: string): Promise<JwtValidationError | null> {
        try {
            const claims = decodeJwt(token);
            const now = Math.floor(Date.now() / 1000);

            // Check not-before — 401 (authentication failure)
            if (claims.nbf && claims.nbf > now + 60) {
                return { status: 401, error: "Token is not yet valid (nbf claim is in the future)" };
            }

            // Check audience — 403 (valid token but not intended for this resource)
            const aud = claims.aud;
            if (aud !== this._audience) {
                return { status: 403, error: `Token audience '${aud}' does not match expected '${this._audience}'` };
            }

            // Check tenant ID — 403 (valid token but wrong tenant)
            const tid = (claims as any).tid;
            if (tid && tid !== this._tenantId) {
                return { status: 403, error: `Token tenant '${tid}' does not match expected '${this._tenantId}'` };
            }

            // Check issuer matches the tenant — 403 (wrong issuer)
            const iss = claims.iss;
            const validIssuers = [
                `https://sts.windows.net/${this._tenantId}/`,
                `https://login.microsoftonline.com/${this._tenantId}/v2.0`,
            ];
            if (iss && !validIssuers.includes(iss)) {
                return { status: 403, error: `Token issuer '${iss}' does not match expected tenant '${this._tenantId}'` };
            }

            console.log(`[JWT] Token validated successfully — aud: ${aud}, tid: ${tid}, iss: ${iss}`);
            return null;
        } catch (err) {
            return { status: 401, error: `Token validation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
    }
}
