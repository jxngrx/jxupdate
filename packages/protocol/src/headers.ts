/** Client apps send this header on check-update and download */
export const HEADER_CHECK_KEY = "x-jx-check-key" as const;

/** Optional explicit publish header (alternative to Authorization Bearer) */
export const HEADER_PUBLISH_KEY = "x-jx-publish-key" as const;
