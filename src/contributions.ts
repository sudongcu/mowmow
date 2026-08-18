import type { Cell, Lawn, Level } from "./types.js";

// GITHUB_GRAPHQL_URL is set on actions runners (and differs on GitHub Enterprise)
const ENDPOINT =
  (typeof process !== "undefined" && process.env?.GITHUB_GRAPHQL_URL) || "https://api.github.com/graphql";

const QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays {
            contributionLevel
            contributionCount
            date
            weekday
          }
        }
      }
    }
  }
}`;

const LEVEL: Record<string, Level> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

interface CalendarDay {
  contributionLevel: string;
  contributionCount: number;
  date: string;
  weekday: number;
}

export async function fetchLawn(login: string, token: string): Promise<Lawn> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "mowmow",
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) {
    throw new Error(`github graphql returned ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    data?: { user: { contributionsCollection: { contributionCalendar: { weeks: { contributionDays: CalendarDay[] }[] } } } | null };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(`github graphql error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data?.user) {
    throw new Error(`github user "${login}" not found`);
  }

  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const cells: Cell[] = [];
  weeks.forEach((week, w) => {
    for (const day of week.contributionDays) {
      cells.push({
        week: w,
        day: day.weekday,
        level: LEVEL[day.contributionLevel] ?? 0,
        count: day.contributionCount,
        date: day.date,
      });
    }
  });
  return { login, weeks: weeks.length, cells };
}
