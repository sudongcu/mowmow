const ENDPOINT = (typeof process !== "undefined" && process.env?.GITHUB_GRAPHQL_URL) || "https://api.github.com/graphql";
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
const LEVEL = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
};
export async function fetchLawn(login, token) {
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
    const json = (await res.json());
    if (json.errors?.length) {
        throw new Error(`github graphql error: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    if (!json.data?.user) {
        throw new Error(`github user "${login}" not found`);
    }
    const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
    const cells = [];
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
