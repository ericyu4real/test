"use client";
import { NavMenu } from "./NavMenu";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavMenu />
      {children}
    </>
  );
}
