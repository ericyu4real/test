// src/components/SlideOver.tsx
import React from "react";
import { X } from "lucide-react";

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SlideOver({ isOpen, onClose, children }: SlideOverProps) {
  return (
    <div
      className={`fixed inset-0 overflow-hidden ${!isOpen && "pointer-events-none"}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={`absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex">
          <div
            className={`w-screen max-w-md transform transition ease-in-out duration-300 ${
              isOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="h-full flex flex-col bg-white shadow-xl">
              <div className="sticky top-0 z-10 bg-white px-4 py-6 border-b">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close panel</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
