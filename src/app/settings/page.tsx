import { getSettings } from "@/app/actions";
import { auth } from "@/lib/clerk";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ClientSettings from "./ClientSettings";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/settings");
  }

  const cookieStore = await cookies();
  const lastPatientId = cookieStore.get("lastPatientId")?.value;

  if (lastPatientId) {
    redirect(`/p/${lastPatientId}/settings`);
  }

  const settings = await getSettings();
  if (settings.currentPatientId) {
    redirect(`/p/${settings.currentPatientId}/settings`);
  }

  return <ClientSettings />;
}
