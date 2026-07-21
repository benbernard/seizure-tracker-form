import { getSettings } from "@/app/actions";
import { auth } from "@/lib/clerk";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function GraphsRedirectPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/graphs");
  }

  const cookieStore = await cookies();
  const lastPatientId = cookieStore.get("lastPatientId")?.value;

  if (lastPatientId) {
    redirect(`/p/${lastPatientId}/graphs`);
  }

  const settings = await getSettings();
  if (settings.currentPatientId) {
    redirect(`/p/${settings.currentPatientId}/graphs`);
  }

  redirect("/settings");
}
