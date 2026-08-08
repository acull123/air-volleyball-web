import type { EventDocument } from "@/lib/firebase/schema";

type TryoutEligibilityEvent = Pick<EventDocument, "ageGroup" | "ageGroups" | "startDate" | "title" | "type">;

type TryoutEligibilityResult =
  | { eligible: true; message?: never }
  | { eligible: false; message: string };

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const tryoutAgeGroupAges = [12, 13, 14, 15, 16, 17, 18];

function parseAgeGroupAge(ageGroup: string) {
  const match = ageGroup.match(/(\d+)\s*U/i);
  const age = match ? Number(match[1]) : Number.NaN;

  return Number.isFinite(age) ? age : null;
}

function parseDateParts(value: string): DateParts | null {
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDateMatch) {
    return {
      year: Number(isoDateMatch[1]),
      month: Number(isoDateMatch[2]),
      day: Number(isoDateMatch[3]),
    };
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function dateKey(date: DateParts) {
  return date.year * 10000 + date.month * 100 + date.day;
}

function formatDate(date: DateParts) {
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getEventAgeGroupLabels(event: TryoutEligibilityEvent) {
  const ageGroups = event.ageGroups?.length ? event.ageGroups : event.ageGroup ? [event.ageGroup] : [];

  return Array.from(new Set(ageGroups)).sort((left, right) => {
    const leftAge = parseAgeGroupAge(left) ?? Number.MAX_SAFE_INTEGER;
    const rightAge = parseAgeGroupAge(right) ?? Number.MAX_SAFE_INTEGER;

    return leftAge - rightAge || left.localeCompare(right);
  });
}

function getTryoutSeasonEndYear(event: TryoutEligibilityEvent) {
  const titleSeasonMatch = event.title.match(/(\d{4})\s*[-–]\s*(\d{4}|\d{2})/);

  if (titleSeasonMatch) {
    const startYear = Number(titleSeasonMatch[1]);
    const endYearText = titleSeasonMatch[2];

    if (endYearText.length === 4) {
      return Number(endYearText);
    }

    const century = Math.floor(startYear / 100) * 100;
    const endYear = century + Number(endYearText);

    return endYear < startYear ? endYear + 100 : endYear;
  }

  const startDate = parseDateParts(event.startDate);

  if (!startDate) {
    return null;
  }

  return startDate.month >= 7 ? startDate.year + 1 : startDate.year;
}

function getBirthdayCutoff(ageGroupAge: number, seasonEndYear: number): DateParts {
  return {
    year: seasonEndYear - ageGroupAge - 1,
    month: 7,
    day: 1,
  };
}

function isBirthDateEligibleForAgeGroup(
  birthDate: DateParts,
  ageGroupAge: number,
  seasonEndYear: number,
) {
  return dateKey(birthDate) >= dateKey(getBirthdayCutoff(ageGroupAge, seasonEndYear));
}

function getRequiredTryoutAgeGroup(birthDate: DateParts, seasonEndYear: number) {
  return (
    tryoutAgeGroupAges.find((ageGroupAge) =>
      isBirthDateEligibleForAgeGroup(birthDate, ageGroupAge, seasonEndYear),
    ) ?? Math.max(...tryoutAgeGroupAges) + 1
  );
}

export function validateTryoutRegistrationEligibility(
  event: TryoutEligibilityEvent,
  playerBirthDate: string,
): TryoutEligibilityResult {
  if (event.type !== "tryout") {
    return { eligible: true };
  }

  const birthDate = parseDateParts(playerBirthDate);
  const seasonEndYear = getTryoutSeasonEndYear(event);
  const selectedAgeGroups = getEventAgeGroupLabels(event);
  const selectedAgeGroupAges = selectedAgeGroups
    .map((ageGroup) => parseAgeGroupAge(ageGroup))
    .filter((ageGroupAge): ageGroupAge is number => ageGroupAge !== null);

  if (!birthDate || !seasonEndYear || selectedAgeGroupAges.length === 0) {
    return { eligible: true };
  }

  const requiredAgeGroup = getRequiredTryoutAgeGroup(birthDate, seasonEndYear);

  if (selectedAgeGroupAges.some((ageGroupAge) => ageGroupAge >= requiredAgeGroup)) {
    return { eligible: true };
  }

  const highestSelectedAgeGroup = Math.max(...selectedAgeGroupAges);
  const cutoff = getBirthdayCutoff(highestSelectedAgeGroup, seasonEndYear);
  const selectedAgeGroupText =
    selectedAgeGroups.length === 1
      ? `${highestSelectedAgeGroup}U tryout`
      : `selected tryout age groups (${selectedAgeGroups.join(", ")})`;
  const recommendedDivision =
    requiredAgeGroup <= Math.max(...tryoutAgeGroupAges)
      ? `a ${requiredAgeGroup}U or older tryout`
      : "an older tryout division";

  return {
    eligible: false,
    message: `This player is not eligible for the ${selectedAgeGroupText}. The birthday cutoff for ${highestSelectedAgeGroup}U is ${formatDate(cutoff)}, and this player's birthday is ${formatDate(birthDate)}. Please register them for ${recommendedDivision}.`,
  };
}
