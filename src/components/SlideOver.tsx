import React from "react";

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
        {/* Background overlay */}
        <div
          className={`absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />

        {/* SlideOver panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex">
          <div
            className={`w-screen max-w-md transform transition ease-in-out duration-300 ${
              isOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
              <div className="flex-1 relative">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
