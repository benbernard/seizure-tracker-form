"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "react-toastify";
import QueryProvider from "../QueryProvider";
import { PatientProvider } from "./PatientContext";
import AuthWrapper from "./AuthWrapper";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <QueryProvider>
        <PatientProvider>
          <AuthWrapper>
            {children}
            <ToastContainer position="bottom-right" theme="dark" />
          </AuthWrapper>
        </PatientProvider>
      </QueryProvider>
    </ClerkProvider>
  );
}
