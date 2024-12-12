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
import { Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function NavMenu() {
  const { signOut, signIn, verifyCode, error, isAuthenticated, isLoading } =
    useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signIn(phoneNumber);
      setIsVerifying(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setSigningIn(true);
      await verifyCode(verificationCode);
      setIsVerifying(false);
      setPhoneNumber("");
      setVerificationCode("");
    } catch (err) {
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 10) {
      setPhoneNumber(value);
    }
  };

  const formatPhoneNumber = (value: string) => {
    if (value.length <= 3) return value;
    if (value.length <= 6) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
    return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  };

  const renderAuthenticatedContent = () => (
    <>
      <SheetHeader>
        <SheetTitle>Menu</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col h-full">
        <div className="mt-8 space-y-4 flex-grow">
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link href="/">Create Journal</Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start" asChild>
            <Link href="/history">History</Link>
          </Button>
        </div>
        <div className="pb-8">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={signOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );

  const renderSignInContent = () => (
    <>
      <SheetHeader>
        <SheetTitle>
          {isVerifying ? "Enter Verification Code" : "Sign In"}
        </SheetTitle>
      </SheetHeader>
      <div className="mt-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isVerifying ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="tel"
                placeholder="(555) 555-5555"
                value={formatPhoneNumber(phoneNumber)}
                onChange={handlePhoneChange}
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Enter your phone number to receive a verification code
              </p>
            </div>
            <Button
              onClick={handleSignIn}
              className="w-full"
              disabled={phoneNumber.length !== 10 || signingIn}
            >
              {signingIn ? "Sending..." : "Continue"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Enter the 6-digit code sent to your phone
              </p>
            </div>
            <Button
              onClick={handleVerifyCode}
              className="w-full"
              disabled={verificationCode.length !== 6 || signingIn}
            >
              {signingIn ? "Verifying..." : "Verify Code"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsVerifying(false)}
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}
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
    return isAuthenticated
      ? renderAuthenticatedContent()
      : renderSignInContent();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="fixed top-4 left-4">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
}
