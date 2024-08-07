import http from "k6/http";
import { SharedArray } from "k6/data";
import { HOSTS } from "./utils/hosts.js";
import { ENDPOINTS } from "./utils/enpoints.js";
import papaparse from "./utils/papaparse.min.js";
import { getEnvVar, randomItem, randomString } from "./utils/utils.js";
import { sleep } from "k6";

// Parameters setup
const ENV_ = getEnvVar("ENV", "remote");
const BASE_URL = getEnvVar("BASE_URL", HOSTS[ENV_]);
const FEEDS_DIR = "./feeds";
const API_PREFIX = "api";
const GET_PREFIX = "GET ";
const POST_PREFIX = "POST ";
const HTTP_TIMEOUT = "10s"; // override default timeout 60s
const PRE_ALLOCATED_VUS_10 = 10; // low load rate
const PRE_ALLOCATED_VUS_50 = 50; // high load rate
// Load rates
const TIME_UNIT = "1m"; // load rates to be set per minute (RPM)
const X_LOAD = getEnvVar("X_LOAD", 1);
const RATE_CREATE_ISSUE = Math.ceil(2 * X_LOAD);
const RATE_UPDATE_ISSUE = Math.ceil(15 * X_LOAD);
const RATE_VIEW_ISSUE = Math.ceil(50 * X_LOAD);
const RATE_SEARCH = Math.ceil(17 * X_LOAD);
// Load Profile
const RAMP_UP = getEnvVar("RAMP_UP", "300s");
const HOLD_RATE = getEnvVar("HOLD_RATE", "10s");
const TEAR_DOWN = getEnvVar("TEAR_DOWN", "10s");

/*
 * Load profile:
 * -> linearly ramp-up to starting X iterations per `timeUnit` over the 'duration' period;
 * -> continue starting X iterations per `timeUnit` for the following 'duration' period;
 * -> linearly ramp-down to starting 0 iterations per `timeUnit` over the 'duration' period.
 */
export const options = {
  tags: {
    env: ENV_,
  },
  scenarios: {
    create_issue: {
      executor: "ramping-arrival-rate",
      exec: "testCreateIssue",
      timeUnit: TIME_UNIT,
      preAllocatedVUs: PRE_ALLOCATED_VUS_10,
      stages: [
        { target: RATE_CREATE_ISSUE, duration: RAMP_UP },
        { target: RATE_CREATE_ISSUE, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
    update_issue: {
      executor: "ramping-arrival-rate",
      exec: "test_update_issue",
      timeUnit: TIME_UNIT,
      preAllocatedVUs: PRE_ALLOCATED_VUS_10,
      stages: [
        { target: RATE_UPDATE_ISSUE, duration: RAMP_UP },
        { target: RATE_UPDATE_ISSUE, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
    view_issue: {
      executor: "ramping-arrival-rate",
      exec: "testViewIssue",
      timeUnit: TIME_UNIT,
      preAllocatedVUs: PRE_ALLOCATED_VUS_50,
      stages: [
        { target: RATE_VIEW_ISSUE, duration: RAMP_UP },
        { target: RATE_VIEW_ISSUE, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
    search: {
      executor: "ramping-arrival-rate",
      exec: "test_search",
      timeUnit: TIME_UNIT,
      preAllocatedVUs: PRE_ALLOCATED_VUS_10,
      stages: [
        { target: RATE_SEARCH, duration: RAMP_UP },
        { target: RATE_SEARCH, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
  },
  // Thresholds defined for specific requests will appear in summary output.
  thresholds: {
    [`http_req_duration{name:${ENDPOINTS["sortedIssues"]["path"]}}`]: [
      "p(90)<500",
    ],
    [`http_req_duration{name:${ENDPOINTS["issuesGetter"]["path"]}}`]: [
      "p(90)<500",
    ],
    [`http_req_duration{name:${ENDPOINTS["issues"]["path"]}}`]: ["p(90)<1000"],
    http_req_failed: ["rate < 0.01"],
  },
};

/*
 * Not using SharedArray here will mean that the code in the function call (that is what loads and
 * parses the csv) will be executed per each VU which also means that there will be a complete copy per each VU.
 *
 * Load CSV file and parse it using Papa Parse.
 */
const tokens = new SharedArray("tokens", function () {
  return papaparse.parse(open(`${FEEDS_DIR}/tokens.csv`), { header: false })
    .data;
});

const summaries = new SharedArray("summaries", function () {
  return papaparse.parse(open(`${FEEDS_DIR}/summaries.csv`), { header: false })
    .data;
});

const descriptions = new SharedArray("descriptions", function () {
  return papaparse.parse(open(`${FEEDS_DIR}/descriptions.csv`), {
    header: false,
  }).data;
});

export function testCreateIssue() {
  const CREATE_ISSUE = "/issues";
  const token = randomItem(tokens);
  const summary = randomItem(summaries);
  const description = randomItem(descriptions);
  const params = {
    tags: { name: CREATE_ISSUE },
    timeout: HTTP_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  // Demo project id 0-0
  const payload = JSON.stringify({
    summary: `${summary[0]} ${randomString(3)}`,
    description: description[0],
    project: {
      id: "0-0",
    },
  });
  // https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html#create-Issue-method
  http.post(`${BASE_URL}/${API_PREFIX}/issues`, payload, params);
}

export function test_update_issue() {
  sleep(1);
}

export function testViewIssue() {
  const token = randomItem(tokens);
  const params = {
    tags: {},
    timeout: HTTP_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  // View Issues
  params.tags.name = GET_PREFIX + ENDPOINTS["sortedIssues"]["path"];
  const res = http.get(
    `${BASE_URL}/${API_PREFIX}${ENDPOINTS["sortedIssues"]["path"]}?${ENDPOINTS["sortedIssues"]["params"]}`,
    params,
  );
  const payload = JSON.stringify({ query: "" });
  params.tags.name = POST_PREFIX + ENDPOINTS["issuesGetterCount"]["path"];
  http.post(
    `${BASE_URL}/${API_PREFIX}${ENDPOINTS["issuesGetterCount"]["path"]}?${ENDPOINTS["issuesGetterCount"]["params"]}`,
    payload,
    params,
  );
  if (res.status === 200) {
    const topIssue = res.json().tree.map((item) => ({
      id: item.id,
    }));
    const payload = JSON.stringify(topIssue);
    params.tags.name = POST_PREFIX + ENDPOINTS["issuesGetter"]["path"];
    http.post(
      `${BASE_URL}/${API_PREFIX}${ENDPOINTS["issuesGetter"]["path"]}?${ENDPOINTS["issuesGetter"]["params"]}`,
      payload,
      params,
    );
    // View Issue
    sleep(3);
    const issueId = randomItem(topIssue).id.split("-")[1];
    params.tags.name = GET_PREFIX + ENDPOINTS["issues"]["path"];
    http.get(
      `${BASE_URL}/${API_PREFIX}${ENDPOINTS["issues"]["path"]}/DEMO-${issueId}?${ENDPOINTS["issues"]["params"]}`,
      params,
    );
  }
}

export function test_search() {
  sleep(1);
}

export default function () {
  testCreateIssue();
  //test_update_issue();
  testViewIssue();
  //test_search();
}
