export const JxUpdateErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export type JxUpdateErrorCode =
  (typeof JxUpdateErrorCodes)[keyof typeof JxUpdateErrorCodes];
