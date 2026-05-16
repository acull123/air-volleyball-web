"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlayerDocument, TeamDocument } from "@/lib/firebase/schema";
import { comparePlayersByName } from "@/lib/player-name";
import { isCurrentPlayer } from "@/lib/player-status";

type FavoritePreference = {
  teamIds: string[];
  playerIds: string[];
};

type FavoritePreferenceDialogProps = {
  open: boolean;
  players: PlayerDocument[];
  teams: TeamDocument[];
  value: FavoritePreference;
  onClose: () => void;
  onSave: (preference: FavoritePreference) => void;
  onSkip: () => void;
};

const popupActionClass =
  "inline-flex justify-center rounded-full border border-[#b8dcff] bg-[color:var(--paper)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] hover:!text-white";

export default function FavoritePreferenceDialog({
  open,
  players,
  teams,
  value,
  onClose,
  onSave,
  onSkip,
}: FavoritePreferenceDialogProps) {
  const [teamSearch, setTeamSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(value.teamIds);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(value.playerIds);
  const hasSavedPreference = value.teamIds.length > 0 || value.playerIds.length > 0;
  const [showPicker, setShowPicker] = useState(hasSavedPreference);

  useEffect(() => {
    if (open) {
      setShowPicker(hasSavedPreference);
      setSelectedTeamIds(value.teamIds);
      setSelectedPlayerIds(value.playerIds);
    }
  }, [hasSavedPreference, open, value.playerIds, value.teamIds]);

  const filteredTeams = useMemo(() => {
    const normalizedSearch = teamSearch.trim().toLowerCase();
    const sortedTeams = [...teams]
      .filter((team) => team.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedSearch) {
      return sortedTeams;
    }

    return sortedTeams.filter((team) =>
      [team.name, team.ageGroup, team.season].join(" ").toLowerCase().includes(normalizedSearch),
    );
  }, [teamSearch, teams]);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = playerSearch.trim().toLowerCase();
    const sortedPlayers = [...players]
      .filter(isCurrentPlayer)
      .sort(comparePlayersByName);

    if (!normalizedSearch) {
      return sortedPlayers;
    }

    return sortedPlayers.filter((player) =>
      [player.firstName, player.lastName, player.position, player.birthDate]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [playerSearch, players]);

  if (!open) {
    return null;
  }

  const hasSelection = selectedTeamIds.length > 0 || selectedPlayerIds.length > 0;

  if (!showPicker) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(9,24,45,0.65)] px-4 py-4 sm:py-8">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-white shadow-[0_30px_80px_rgba(8,23,45,0.28)]">
            <div className="px-5 py-6 lg:px-8 lg:py-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    Welcome
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-[color:var(--ink)] sm:text-4xl">
                    Welcome To Air Volleyball
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                >
                  Close
                </button>
              </div>

              <p className="mt-5 text-sm leading-7 text-[color:var(--muted)] sm:text-base">
                Tell us which players or teams matter to your family so the website can highlight relevant events,
                registration links, schedules, and updates. Signing in is the best option because your linked players
                can personalize the site automatically.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/login"
                  className={popupActionClass}
                >
                  Sign In Or Create Account
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className={popupActionClass}
                >
                  Pick Favorites For Now
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="inline-flex justify-center rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
                >
                  Skip For Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(9,24,45,0.65)] px-4 py-4 sm:py-8">
      <div className="flex min-h-full items-start justify-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-white shadow-[0_30px_80px_rgba(8,23,45,0.28)] sm:max-h-[90vh]">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-5 py-5 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Favorite
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">
              Pick Favorite Teams And Players
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
              Save your favorite teams and players so the website can highlight the most relevant events for your family.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-full border border-[#b8dcff] bg-[color:var(--paper)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:border-transparent hover:bg-[radial-gradient(circle_at_top_left,rgba(255,186,84,0.2),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(132,181,255,0.22),transparent_24%),linear-gradient(135deg,rgb(29,103,205)_0%,#1b5cc2_38%,#123f8d_72%,#0b2857_100%)] hover:!text-white"
            >
              Sign In Or Create Account
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-[color:var(--ink)]">Favorite Teams</h3>
                <span className="text-sm font-semibold text-[color:var(--muted)]">
                  {selectedTeamIds.length} selected
                </span>
              </div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Search teams
                <input
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Search by team name, age group, or season"
                />
              </label>
              <div className="max-h-[18rem] space-y-3 overflow-y-auto pr-2 sm:max-h-[22rem]">
                {filteredTeams.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id);

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() =>
                        setSelectedTeamIds((current) =>
                          current.includes(team.id)
                            ? current.filter((entry) => entry !== team.id)
                            : [...current, team.id],
                        )
                      }
                      className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                        isSelected
                          ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                      }`}
                    >
                      <p className="text-lg font-bold text-[color:var(--ink)]">{team.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {[team.ageGroup, team.season].filter(Boolean).join(" · ") || "Team details coming soon"}
                      </p>
                    </button>
                  );
                })}
                {filteredTeams.length === 0 && (
                  <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    No teams match the current search.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold text-[color:var(--ink)]">Favorite Players</h3>
                <span className="text-sm font-semibold text-[color:var(--muted)]">
                  {selectedPlayerIds.length} selected
                </span>
              </div>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[color:var(--ink)]">
                Search players
                <input
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  className="rounded-2xl border border-[color:var(--line)] px-4 py-3"
                  placeholder="Search by player name, position, or birthday"
                />
              </label>
              <div className="max-h-[18rem] space-y-3 overflow-y-auto pr-2 sm:max-h-[22rem]">
                {filteredPlayers.map((player) => {
                  const playerTeam = teams.find((team) => team.id === player.teamId);
                  const isSelected = selectedPlayerIds.includes(player.id);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() =>
                        setSelectedPlayerIds((current) =>
                          current.includes(player.id)
                            ? current.filter((entry) => entry !== player.id)
                            : [...current, player.id],
                        )
                      }
                      className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition ${
                        isSelected
                          ? "border-[color:var(--ink)] bg-[color:var(--paper)]"
                          : "border-[color:var(--line)] bg-white hover:bg-[color:var(--paper)]"
                      }`}
                    >
                      <p className="text-lg font-bold text-[color:var(--ink)]">
                        {player.firstName} {player.lastName}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {[playerTeam?.name, player.position].filter(Boolean).join(" · ") || "Player details coming soon"}
                      </p>
                    </button>
                  );
                })}
                {filteredPlayers.length === 0 && (
                  <div className="rounded-2xl border border-[color:var(--line)] px-4 py-4 text-sm text-[color:var(--muted)]">
                    No players match the current search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-5 py-5 lg:px-8">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--paper)]"
          >
            Skip For Now
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => onSave({ teamIds: selectedTeamIds, playerIds: selectedPlayerIds })}
            className="rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#143b66] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save Favorites
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
