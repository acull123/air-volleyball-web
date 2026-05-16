import type { TeamDocument } from "@/lib/firebase/schema";

function getAgeGroupSortValue(ageGroup: string) {
  const match = ageGroup.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export function compareTeamsByAge(left: Pick<TeamDocument, "ageGroup" | "name">, right: Pick<TeamDocument, "ageGroup" | "name">) {
  return (
    getAgeGroupSortValue(left.ageGroup) - getAgeGroupSortValue(right.ageGroup) ||
    left.ageGroup.localeCompare(right.ageGroup) ||
    left.name.localeCompare(right.name)
  );
}
