import { isLocalAuth } from "@/lib/clerk";
import { ClerkProvider, LocalAuthProvider } from "@/lib/clerk-client";
import { ToastContainer } from "react-toastify";
import QueryProvider from "../QueryProvider";
import AuthWrapper from "./AuthWrapper";
import { PatientProvider } from "./PatientContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const localUserId = isLocalAuth()
    ? process.env.LOCAL_AUTH_USER_ID
    : undefined;

  const providers = (
    <QueryProvider>
      <PatientProvider>
        <AuthWrapper>
          {children}
          <ToastContainer position="bottom-right" theme="dark" />
        </AuthWrapper>
      </PatientProvider>
    </QueryProvider>
  );

  if (localUserId) {
    return (
      <LocalAuthProvider userId={localUserId}>{providers}</LocalAuthProvider>
    );
  }

  return <ClerkProvider>{providers}</ClerkProvider>;
}
