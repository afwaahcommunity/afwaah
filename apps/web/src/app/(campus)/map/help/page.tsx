import { redirect } from "next/navigation";
import { CampusMapHelpPage } from "@/features/campus-map/components/CampusMapHelpPage";
import { env } from "@/lib/env";

export default function MapHelpPage() {
  // Chat-only deploys keep this route disabled until the map is ready to publish.
  if (!env.enableMap) redirect("/rooms");

  return <CampusMapHelpPage />;
}
