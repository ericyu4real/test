// src/middleware/auth.ts
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Request, Response, NextFunction } from "express";
import { config } from "dotenv";

config();

// Configure the verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_CLIENT_ID!,
  tokenUse: "access",
});

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const payload = await verifier.verify(token);
    return payload.sub as string;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// Middleware function for protected routes
export function authMiddleware() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        throw new Error("No token provided");
      }

      const userId = await verifyToken(token);
      if (!userId) {
        throw new Error("Invalid token");
      }

      // Add userId to request for use in route handlers
      (req as any).userId = userId;
      next();
    } catch (error) {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
