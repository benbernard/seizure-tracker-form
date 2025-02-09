import { getSettings } from "./actions";
import ClientPage from "./ClientPage";

export default async function Home() {
  const settings = await getSettings();
  return <ClientPage initialSettings={settings} />;
}
