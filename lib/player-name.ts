type NameLike = {
  firstName: string;
  lastName: string;
};

type AthleteNameLike = {
  athleteFirstName: string;
  athleteLastName: string;
};

export function compareNames(
  leftFirstName: string,
  leftLastName: string,
  rightFirstName: string,
  rightLastName: string,
) {
  return `${leftFirstName} ${leftLastName}`.localeCompare(`${rightFirstName} ${rightLastName}`);
}

export function comparePlayersByName<T extends NameLike>(left: T, right: T) {
  return compareNames(left.firstName, left.lastName, right.firstName, right.lastName);
}

export function compareAthletesByName<T extends AthleteNameLike>(left: T, right: T) {
  return compareNames(
    left.athleteFirstName,
    left.athleteLastName,
    right.athleteFirstName,
    right.athleteLastName,
  );
}

