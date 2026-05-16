"use client";

import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import FavoritePreferenceDialog from "./components/FavoritePreferenceDialog";
import EventCard from "./components/EventCard";
import PageHero from "./components/PageHero";
import SectionCard from "./components/SectionCard";
import { getEventStatus } from "@/lib/event-status";
import { getEventTeamIds } from "@/lib/event-teams";
import { useFirestoreCollection } from "@/lib/firebase";
import type { Event } from "./types/models";
import type { EventDocument, PlayerDocument, TeamDocument } from "@/lib/firebase/schema";
import { isCurrentPlayer } from "@/lib/player-status";

const favoritePreferenceCookieName = "air-favorite-preference";
const favoritePreferenceDismissedCookieName = "air-favorite-prompt-dismissed";

type FavoritePreference = {
  teamIds: string[];
  playerIds: string[];
};

const scheelsLogoUrl =
  "https://res.cloudinary.com/dlwdq84ig/image/upload/w_3840%2Cq_auto%2Cc_scale/x1qgcm5jcooqwptm0kbq";

function getEventHref(event: EventDocument) {
  if (event.type === "camp" || event.type === "tryout") {
    return `/register?event=${event.id}`;
  }

  if (event.type === "refScoringClinic") {
    return "/about#ref-scoring-clinic";
  }

  return `/events/${event.id}`;
}

function buildEventCardItem(event: EventDocument): Event {
  return {
    id: event.id,
    eventName: event.title,
    eventType:
      event.type === "tryout"
        ? "tryouts"
        : event.type === "twoDayTournament"
          ? "tournament"
        : event.type === "areaCamp"
          ? "camp"
          : event.type === "refScoringClinic"
            ? "clinic"
            : event.type,
    description: event.notes,
    startsAt: `${event.startDate}T${event.startTime || "00:00"}`,
    endsAt: `${event.endDate || event.startDate}T${event.endTime || event.startTime || "00:00"}`,
    teamIds: getEventTeamIds(event),
    coachIds: [],
    playerIds: [],
    location: event.location,
    href: getEventHref(event),
    status: getEventStatus(event),
  };
}

function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];

  return value ? decodeURIComponent(value) : null;
}

function readFavoritePreferenceCookie(): FavoritePreference | null {
  const rawValue = getCookie(favoritePreferenceCookieName);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | FavoritePreference
      | { type: "team"; id: string }
      | { type: "player"; id: string };

    if (
      parsed &&
      "teamIds" in parsed &&
      "playerIds" in parsed &&
      Array.isArray(parsed.teamIds) &&
      Array.isArray(parsed.playerIds)
    ) {
      return parsed;
    }

    if (parsed && "type" in parsed && "id" in parsed && typeof parsed.id === "string") {
      return parsed.type === "team"
        ? { teamIds: [parsed.id], playerIds: [] }
        : { teamIds: [], playerIds: [parsed.id] };
    }
  } catch {
    return null;
  }

  return null;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") {
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function subscribeToHydration() {
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function getAgeOnDate(birthDate: string, referenceDate: string) {
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) {
    return null;
  }

  let age = reference.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    reference.getMonth() > birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() >= birth.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

function getAgeGroupForPlayer(player: PlayerDocument, event: EventDocument, teams: TeamDocument[]) {
  const playerTeam = teams.find((team) => team.id === player.teamId);

  if (playerTeam?.ageGroup) {
    return playerTeam.ageGroup;
  }

  const age = getAgeOnDate(player.birthDate, event.startDate);

  if (age === null) {
    return null;
  }

  return `${Math.max(10, Math.min(age, 18))}U`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0",
  )}`;
}

function isCurrentOrFutureEvent(event: EventDocument) {
  const todayKey = toDateKey(new Date());
  const eventEndDate = event.endDate || event.startDate;

  return !eventEndDate || eventEndDate >= todayKey;
}

function getEventAgeGroup(event: EventDocument) {
  return event.ageGroup || (event as EventDocument & { ageGroups?: string[] }).ageGroups?.[0] || "";
}

export default function HomePage() {
  const clientReady = useSyncExternalStore(
    subscribeToHydration,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const events = useFirestoreCollection("events");
  const coaches = useFirestoreCollection("coaches");
  const players = useFirestoreCollection("players");
  const teams = useFirestoreCollection("teams");
  const [favoritePreferenceOverride, setFavoritePreferenceOverride] = useState<FavoritePreference | null>(null);
  const [favoriteDialogForcedOpen, setFavoriteDialogForcedOpen] = useState(false);
  const [favoriteDialogDismissed, setFavoriteDialogDismissed] = useState(false);
  const favoritePreference = clientReady
    ? favoritePreferenceOverride ?? readFavoritePreferenceCookie()
    : favoritePreferenceOverride;
  const promptDismissed = clientReady && getCookie(favoritePreferenceDismissedCookieName) === "1";
  const favoriteDialogOpen =
    favoriteDialogForcedOpen ||
    (clientReady && !favoritePreference && !promptDismissed && !favoriteDialogDismissed);

  const upcomingEvents = useMemo<Event[]>(() => {
    return [...events.data]
      .filter((event) => event.active !== false)
      .filter(isCurrentOrFutureEvent)
      .filter((event) => event.type !== "areaCamp")
      .sort((a, b) => {
        const left = new Date(`${a.startDate}T${a.startTime || "00:00"}`).getTime();
        const right = new Date(`${b.startDate}T${b.startTime || "00:00"}`).getTime();
        return left - right;
      })
      .slice(0, 4)
      .map(buildEventCardItem);
  }, [events.data]);

  const recommendedState = useMemo(() => {
    if (
      !favoritePreference ||
      (favoritePreference.teamIds.length === 0 && favoritePreference.playerIds.length === 0)
    ) {
      return {
        title: "",
        events: [] as Event[],
      };
    }
    const favoriteTeams = teams.data.filter((team) => favoritePreference.teamIds.includes(team.id));
    const favoritePlayers = players.data.filter(
      (player) => isCurrentPlayer(player) && favoritePreference.playerIds.includes(player.id),
    );
    const relatedTeamIds = new Set<string>([
      ...favoritePreference.teamIds,
      ...favoritePlayers.map((player) => player.teamId).filter(Boolean),
    ]);
    const relatedAgeGroups = new Set<string>([
      ...favoriteTeams.map((team) => team.ageGroup).filter(Boolean),
      ...favoritePlayers
        .map((player) => teams.data.find((team) => team.id === player.teamId)?.ageGroup ?? "")
        .filter((ageGroup): ageGroup is string => Boolean(ageGroup)),
    ]);

    const recommendedEvents = events.data
      .filter((event) => event.active !== false)
      .filter(isCurrentOrFutureEvent)
      .filter((event) => event.type !== "areaCamp")
      .filter((event) => {
        const eventTeamIds = getEventTeamIds(event);
        return eventTeamIds.length === 0 || eventTeamIds.some((teamId) => relatedTeamIds.has(teamId));
      })
      .filter((event) => {
        const eventAgeGroup = getEventAgeGroup(event);

        if (!eventAgeGroup) {
          return true;
        }

        if (relatedAgeGroups.has(eventAgeGroup)) {
          return true;
        }

        return favoritePlayers.some((player) => getAgeGroupForPlayer(player, event, teams.data) === eventAgeGroup);
      })
      .sort((a, b) => {
        const left = new Date(`${a.startDate}T${a.startTime || "00:00"}`).getTime();
        const right = new Date(`${b.startDate}T${b.startTime || "00:00"}`).getTime();
        return left - right;
      })
      .slice(0, 4)
      .map(buildEventCardItem);

    return {
      title: "Recommended For Your Favorites",
      events: recommendedEvents,
    };
  }, [events.data, favoritePreference, players.data, teams.data]);

  const summary = useMemo(
    () => ({
      teams: teams.data.filter((team) => team.active !== false).length,
      players: players.data.filter(isCurrentPlayer).length,
      coaches: coaches.data.filter((coach) => coach.active !== false).length,
    }),
    [coaches.data, players.data, teams.data],
  );

  function handleSaveFavorite(preference: FavoritePreference) {
    setFavoritePreferenceOverride(preference);
    setFavoriteDialogForcedOpen(false);
    setFavoriteDialogDismissed(false);
    clearCookie(favoritePreferenceDismissedCookieName);
    setCookie(favoritePreferenceCookieName, JSON.stringify(preference), 365);
  }

  function handleSkipFavorite() {
    setFavoriteDialogForcedOpen(false);
    setFavoriteDialogDismissed(true);
    setCookie(favoritePreferenceDismissedCookieName, "1", 30);
  }

  return (
    <>
      <FavoritePreferenceDialog
        key={`${favoriteDialogOpen ? "open" : "closed"}-${JSON.stringify(
          favoritePreference ?? { teamIds: [], playerIds: [] },
        )}`}
        open={favoriteDialogOpen}
        players={players.data}
        teams={teams.data}
        value={favoritePreference ?? { teamIds: [], playerIds: [] }}
        onClose={() => {
          setFavoriteDialogForcedOpen(false);
          setFavoriteDialogDismissed(true);
        }}
        onSave={handleSaveFavorite}
        onSkip={handleSkipFavorite}
      />

      <PageHero
        eyebrow="Air Volleyball Club"
        title="Welcome To Air Volleyball Club"
        description="Air Volleyball Club serves the Chippewa Valley and focuses on helping athletes improve on and off the court through strong coaching, training, and club opportunities. The club describes itself as a youth volleyball program built to teach, develop, and support athletes through the sport of volleyball."
        actions={[
          { href: "/register", label: "Join Air Volleyball" },
          { href: "/about", label: "Find Out More", variant: "secondary" },
        ]}
      />

      {favoritePreference && (
        <SectionCard
          title={recommendedState.title}
          kicker="Recommended Events"
          headerAction={
            <button
              type="button"
              onClick={() => {
                setFavoriteDialogDismissed(false);
                setFavoriteDialogForcedOpen(true);
              }}
              className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
            >
              Change Favorite
            </button>
          }
        >
          {recommendedState.events.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No recommended events are available yet for this favorite.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {recommendedState.events.map((event) => (
                <EventCard key={event.id} e={event} variant="home" />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Upcoming Events" kicker="Schedule">
        {events.loading ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Loading upcoming events...
          </div>
        ) : events.error ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            Upcoming events are unavailable right now.
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--line)] px-6 py-10 text-center text-sm text-[color:var(--muted)]">
            No upcoming events have been added yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} e={event} variant="home" />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Club Snapshot" kicker="Live Overview">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Teams
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.teams}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Players
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.players}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[color:var(--paper)] px-5 py-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Active Coaches
            </p>
            <p className="mt-2 font-[family:var(--font-display)] text-5xl uppercase leading-none text-[color:var(--ink)]">
              {summary.coaches}
            </p>
          </div>
        </div>
      </SectionCard>

      <section className="rounded-full border border-[color:var(--line)] bg-white/90 px-5 py-4 shadow-[0_18px_40px_rgba(17,58,98,0.08)]">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-start md:text-left">
          <div className="md:min-w-[20rem]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Sponsor
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
              Thanks to Scheels for supporting Air Volleyball Club.
            </p>
          </div>
          <a
            href="https://www.scheels.com/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
            aria-label="Visit Scheels"
          >
            <Image
              src={scheelsLogoUrl}
              alt="SCHEELS Employee Owned"
              width={240}
              height={36}
              unoptimized
              className="h-9 w-auto object-contain"
            />
          </a>
        </div>
      </section>
    </>
  );
}
