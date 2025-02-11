// src/contexts/AuthContext.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  SignUpCommand,
  NotAuthorizedException,
  InitiateAuthCommandOutput,
  UserNotConfirmedException,
  ResendConfirmationCodeCommand,
  ConfirmSignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getSession: () => string | null;
  confirmSignUp: (
    username: string,
    code: string,
    password: string,
  ) => Promise<void>;
  resendConfirmationCode: (username: string) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const router = useRouter();

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
      () => refreshSession(),
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

  // Add these methods in the AuthProvider
  const confirmSignUp = async (
    username: string,
    code: string,
    password: string,
  ) => {
    try {
      setError(null);
      const command = new ConfirmSignUpCommand({
        ClientId: cognitoConfig.clientId,
        Username: username,
        ConfirmationCode: code,
      });

      await client.send(command);
      // Auto sign in after confirmation with the provided password
      await signIn(username, password);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Confirmation failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const resendConfirmationCode = async (username: string) => {
    try {
      setError(null);
      const command = new ResendConfirmationCodeCommand({
        ClientId: cognitoConfig.clientId,
        Username: username,
      });

      await client.send(command);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resend code";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Modify signIn to catch UserNotConfirmedException
  const signIn = async (username: string, password: string) => {
    try {
      setError(null);
      const command = new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: cognitoConfig.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await client.send(command);
      handleAuthResponse(response);
    } catch (err) {
      if (err instanceof UserNotConfirmedException) {
        setError("USER_NOT_CONFIRMED");
        throw err;
      }
      const errorMessage =
        err instanceof Error ? err.message : "Sign in failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      setError(null);
      const command = new SignUpCommand({
        ClientId: cognitoConfig.clientId,
        Username: username,
        Password: password,
      });

      await client.send(command);
      // Auto sign in after successful signup
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Sign up failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const handleSignOut = async () => {
    clearTokens();
    setTokens(null);
    setIsAuthenticated(false);
    setError(null);
    router.push("/"); // Add this line to redirect on sign out
  };

  const handleAuthResponse = (response: InitiateAuthCommandOutput) => {
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
  };

  const getSession = () => tokens?.accessToken || null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        setError,
        signIn,
        signUp,
        signOut: handleSignOut,
        getSession,
        confirmSignUp,
        resendConfirmationCode,
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
