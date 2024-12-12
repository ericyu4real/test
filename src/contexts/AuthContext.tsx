"use client";
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GetUserCommand,
  NotAuthorizedException,
} from "@aws-sdk/client-cognito-identity-provider";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  phoneNumber: string | null;
  signIn: (phoneNumber: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  getSession: () => string | null;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const cognitoConfig = {
  region: "us-east-1",
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
};

const client = new CognitoIdentityProviderClient({
  region: cognitoConfig.region,
});

// Token management utilities
const storeTokens = (tokens: AuthTokens) => {
  localStorage.setItem("auth_tokens", JSON.stringify(tokens));
};

const getStoredTokens = (): AuthTokens | null => {
  const tokens = localStorage.getItem("auth_tokens");
  return tokens ? JSON.parse(tokens) : null;
};

const clearTokens = () => {
  localStorage.removeItem("auth_tokens");
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!tokens) return;

    const timeUntilExpiry = tokens.expiresAt - Date.now();
    if (timeUntilExpiry <= 0) {
      refreshSession();
      return;
    }

    // Refresh 5 minutes before expiry
    const refreshTimeout = setTimeout(
      () => {
        refreshSession();
      },
      timeUntilExpiry - 5 * 60 * 1000,
    );

    return () => clearTimeout(refreshTimeout);
  }, [tokens]);

  const refreshSession = async () => {
    try {
      const currentTokens = getStoredTokens();
      if (!currentTokens?.refreshToken) {
        throw new Error("No refresh token available");
      }

      const command = new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: cognitoConfig.clientId,
        AuthParameters: {
          REFRESH_TOKEN: currentTokens.refreshToken,
        },
      });

      const response = await client.send(command);
      const result = response.AuthenticationResult;

      if (result?.AccessToken && result.IdToken) {
        const newTokens: AuthTokens = {
          accessToken: result.AccessToken,
          refreshToken: currentTokens.refreshToken, // Keep existing refresh token
          idToken: result.IdToken,
          expiresAt: Date.now() + (result.ExpiresIn || 3600) * 1000,
        };
        storeTokens(newTokens);
        setTokens(newTokens);
      }
    } catch (err) {
      console.error("Failed to refresh session:", err);
      handleSignOut();
    }
  };

  const checkAuthStatus = async () => {
    try {
      const storedTokens = getStoredTokens();
      if (!storedTokens) {
        setIsLoading(false);
        return;
      }

      if (Date.now() >= storedTokens.expiresAt) {
        await refreshSession();
      } else {
        // Verify the session is still valid
        const command = new GetUserCommand({
          AccessToken: storedTokens.accessToken,
        });

        await client.send(command);
        setTokens(storedTokens);
        setIsAuthenticated(true);
      }
    } catch (err) {
      if (err instanceof NotAuthorizedException) {
        await refreshSession();
      } else {
        handleSignOut();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    clearTokens();
    setTokens(null);
    setIsAuthenticated(false);
    setPhoneNumber(null);
    setError(null);
  };

  const signIn = async (phone: string) => {
    try {
      setError(null);
      const formattedPhone = phone.startsWith("+1") ? phone : `+1${phone}`;
      setPhoneNumber(formattedPhone);

      const command = new InitiateAuthCommand({
        AuthFlow: "CUSTOM_AUTH",
        ClientId: cognitoConfig.clientId,
        AuthParameters: {
          USERNAME: formattedPhone,
        },
      });

      await client.send(command);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during sign in";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verifyCode = async (code: string) => {
    if (!phoneNumber) {
      setError("Phone number is missing");
      return;
    }

    try {
      setError(null);
      const command = new RespondToAuthChallengeCommand({
        ClientId: cognitoConfig.clientId,
        ChallengeName: "CUSTOM_CHALLENGE",
        ChallengeResponses: {
          USERNAME: phoneNumber,
          ANSWER: code,
        },
      });

      const response = await client.send(command);
      const result = response.AuthenticationResult;

      if (result?.AccessToken && result.IdToken && result.RefreshToken) {
        const newTokens: AuthTokens = {
          accessToken: result.AccessToken,
          refreshToken: result.RefreshToken,
          idToken: result.IdToken,
          expiresAt: Date.now() + (result.ExpiresIn || 3600) * 1000,
        };
        storeTokens(newTokens);
        setTokens(newTokens);
        setIsAuthenticated(true);
      } else {
        throw new Error("Invalid authentication result");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Invalid verification code";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getSession = () => tokens?.accessToken || null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        phoneNumber,
        signIn,
        verifyCode,
        signOut: handleSignOut,
        error,
        getSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
