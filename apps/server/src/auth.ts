import type { FastifyReply, FastifyRequest } from "fastify";
import {
  HEADER_CHECK_KEY,
  HEADER_PUBLISH_KEY,
  JxUpdateErrorCodes,
} from "@jxupdate/protocol";
import type { AppEntry } from "./config.js";

function bearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.slice("Bearer ".length).trim();
}

export function requirePublishAuth(
  req: FastifyRequest,
  app: AppEntry,
): boolean {
  const fromBearer = bearerToken(req.headers.authorization);
  const fromHeader = req.headers[HEADER_PUBLISH_KEY] as string | undefined;
  const secret = fromBearer ?? fromHeader;
  return secret === app.publishSecret;
}

export function requireCheckAuth(req: FastifyRequest, app: AppEntry): boolean {
  const key = req.headers[HEADER_CHECK_KEY] as string | undefined;
  return key === app.checkSecret;
}

export function sendUnauthorized(reply: FastifyReply): void {
  void reply.status(401).send({
    error: {
      code: JxUpdateErrorCodes.UNAUTHORIZED,
      message: "Invalid or missing credentials",
    },
  });
}
