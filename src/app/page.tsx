import ClientPage from "./ClientPage";
import { getSettings } from "./actions";

export default async function Home() {
  const settings = await getSettings();
  return <ClientPage initialSettings={settings} />;
}
