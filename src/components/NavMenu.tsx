// src/components/NavMenu.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Menu, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserNotConfirmedException } from "@aws-sdk/client-cognito-identity-provider";

export function NavMenu() {
  const {
    isAuthenticated,
    isLoading,
    error,
    setError,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    resendConfirmationCode,
  } = useAuth();

  const [isSignUp, setIsSignUp] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [storedPassword, setStoredPassword] = useState(""); // Store password for auto-login after confirmation

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setIsProcessing(true);
      if (isSignUp) {
        await signUp(username, password);
        setStoredPassword(password);
        setNeedsConfirmation(true);
      } else {
        await signIn(username, password);
      }
    } catch (err) {
      // Change this part
      if (err instanceof UserNotConfirmedException) {
        setStoredPassword(password);
        setNeedsConfirmation(true);
      } else {
        console.error(err);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationCode) {
      setError("Please enter confirmation code");
      return;
    }

    try {
      setIsProcessing(true);
      await confirmSignUp(username, confirmationCode, storedPassword);
      setNeedsConfirmation(false);
      setConfirmationCode("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsProcessing(true);
      await resendConfirmationCode(username);
      setError("New code has been sent to your email");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderAuthenticatedMenu = () => (
    <>
      <SheetHeader>
        <SheetTitle>Menu</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col h-full">
        <nav className="mt-8 space-y-4 flex-grow">
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link href="/">Create Journal</Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link href="/history">History</Link>
          </Button>
        </nav>
        <div className="pb-8">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );

  const renderAuthContent = () => (
    <>
      <SheetHeader>
        <SheetTitle>{isSignUp ? "Sign Up" : "Sign In"}</SheetTitle>
      </SheetHeader>

      <div className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isProcessing}>
            {isProcessing ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>

          <div className="text-center text-sm text-gray-600">
            {isSignUp ? (
              <p>
                Have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Don&#39;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                    setUsername("");
                    setPassword("");
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </>
  );

  const renderConfirmationContent = () => (
    <>
      <SheetHeader>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setNeedsConfirmation(false);
              setError(null);
            }}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SheetTitle>Verify Account</SheetTitle>
        </div>
      </SheetHeader>

      <div className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleConfirmationSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Enter verification code"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            className="w-full"
          />

          <Button type="submit" className="w-full" disabled={isProcessing}>
            {isProcessing ? "Verifying..." : "Verify Account"}
          </Button>

          <div className="text-center text-sm text-gray-600">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isProcessing}
              className="text-blue-600 hover:text-blue-800"
            >
              Resend code
            </button>
          </div>
        </form>
      </div>
    </>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      );
    }
    if (isAuthenticated) {
      return renderAuthenticatedMenu();
    }
    if (needsConfirmation) {
      return renderConfirmationContent();
    }
    return renderAuthContent();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed top-4 left-4">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px]">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}
