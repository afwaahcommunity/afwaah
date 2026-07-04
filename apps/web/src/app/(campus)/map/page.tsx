import { redirect } from "next/navigation";
import { CampusMapPage } from "@/features/campus-map/components/CampusMapPage";
import { env } from "@/lib/env";

export default function MapPage() {
  // Chat-only deploys keep this route disabled until the map is ready to publish.
  if (!env.enableMap) redirect("/rooms");

  return <CampusMapPage />;
}
