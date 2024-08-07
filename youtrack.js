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
const PRE_ALLOCATED_VUS_20 = 20; // low load rate
const PRE_ALLOCATED_VUS_100 = 100; // high load rate
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
      preAllocatedVUs: PRE_ALLOCATED_VUS_20,
      stages: [
        { target: RATE_CREATE_ISSUE, duration: RAMP_UP },
        { target: RATE_CREATE_ISSUE, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
    update_issue: {
      executor: "ramping-arrival-rate",
      exec: "testUpdateIssue",
      timeUnit: TIME_UNIT,
      preAllocatedVUs: PRE_ALLOCATED_VUS_20,
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
      preAllocatedVUs: PRE_ALLOCATED_VUS_100,
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
      preAllocatedVUs: PRE_ALLOCATED_VUS_20,
      stages: [
        { target: RATE_SEARCH, duration: RAMP_UP },
        { target: RATE_SEARCH, duration: HOLD_RATE },
        { target: 0, duration: TEAR_DOWN },
      ],
    },
  },
  // Thresholds defined for specific requests will appear in summary output.
  thresholds: {
    [`http_req_duration{name:${GET_PREFIX + ENDPOINTS["sortedIssues"]["path"]}}`]:
      ["p(90)<500"],
    [`http_req_duration{name:${POST_PREFIX + ENDPOINTS["issuesGetter"]["path"]}}`]:
      ["p(90)<1000"],
    [`http_req_duration{name:${GET_PREFIX + ENDPOINTS["issues"]["path"]}}`]: [
      "p(90)<500",
    ],
    [`http_req_duration{name:${POST_PREFIX + ENDPOINTS["drafts"]["path"]}}`]: [
      "p(90)<1000",
    ],
    [`http_req_duration{name:${POST_PREFIX + ENDPOINTS["issues"]["path"]}}`]: [
      "p(90)<1000",
    ],
    [`http_req_duration{name:${POST_PREFIX + ENDPOINTS["commandsAssist"]["path"]}}`]:
      ["p(90)<1000"],
    [`http_req_duration{name:${POST_PREFIX + ENDPOINTS["commands"]["path"]}}`]:
      ["p(90)<1000"],
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

const comments = new SharedArray("comments", function () {
  return papaparse.parse(open(`${FEEDS_DIR}/comments.csv`), {
    header: false,
  }).data;
});

const states = new SharedArray("states", function () {
  return [
    "Submitted",
    "Open",
    "In Progress",
    "To be discussed",
    "Reopened",
    "Can't Reproduce",
    "Fixed",
    "Won't fix",
    "Incomplete",
    "Obsolete",
    "Verified",
  ];
});

export function testCreateIssue() {
  const token = randomItem(tokens);
  const summary = randomItem(summaries);
  const description = randomItem(descriptions);
  const params = {
    tags: {},
    timeout: HTTP_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  params.tags.name = POST_PREFIX + ENDPOINTS["drafts"]["path"];
  const res = http.post(
    `${BASE_URL}/${API_PREFIX}${ENDPOINTS["drafts"]["path"]}?${ENDPOINTS["drafts"]["params"]}`,
    JSON.stringify({}),
    params,
  );
  if (res.json().id) {
    sleep(5);
    const draftId = res.json().id;
    const payload = JSON.stringify({
      summary: `${summary[0]} ${randomString(3)}`,
      description: description[0],
      markdownEmbeddings: [],
      project: {
        id: "0-0",
      },
    });
    const res_drafts = http.post(
      `${BASE_URL}/${API_PREFIX}${ENDPOINTS["drafts"]["path"]}/${draftId}?${ENDPOINTS["drafts"]["params"]}`,
      payload,
      params,
    );
    if (res_drafts.status === 200) {
      params.tags.name = POST_PREFIX + ENDPOINTS["issues"]["path"];
      http.post(
        `${BASE_URL}/${API_PREFIX}${ENDPOINTS["issues"]["path"]}/?draftId=${draftId}&${ENDPOINTS["issues"]["params_post"]}`,
        JSON.stringify({}),
        params,
      );
    }
  }
}

export function testUpdateIssue() {
  const token = randomItem(tokens);
  const state = randomItem(states);
  const comment = randomItem(comments)[0];
  const params = {
    tags: {},
    timeout: HTTP_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  /*
   * Parse issueId from top issues
   * Note that it introduces slight imbalance in load model, could be done in a different way - generate ID or prepare a CSV feed
   */
  params.tags.name = GET_PREFIX + ENDPOINTS["sortedIssues"]["path"];
  const res = http.get(
    `${BASE_URL}/${API_PREFIX}${ENDPOINTS["sortedIssues"]["path"]}?${ENDPOINTS["sortedIssues"]["params"]}`,
    params,
  );
  if (res.status === 200) {
    const topIssues = res.json().tree.map((item) => ({
      id: item.id,
    }));
    const issueId = randomItem(topIssues).id;
    if (issueId) {
      // Assign to "me" + change State
      params.tags.name = POST_PREFIX + ENDPOINTS["commandsAssist"]["path"];
      let payload = JSON.stringify({
        query: "Assignee me State",
        caret: 17,
        issues: [{ id: issueId }],
      });
      http.post(
        `${BASE_URL}/${API_PREFIX}${ENDPOINTS["commandsAssist"]["path"]}?${ENDPOINTS["commandsAssist"]["params"]}`,
        payload,
        params,
      );
      params.tags.name = POST_PREFIX + ENDPOINTS["commands"]["path"];
      payload = JSON.stringify({
        comment: null,
        usesMarkdown: true,
        silent: false,
        prevCaret: 18,
        caret: 23,
        selection: 23,
        query: `Assignee me State ${state} `,
        focus: true,
        issues: [{ id: issueId }],
      });
      http.post(
        `${BASE_URL}/${API_PREFIX}${ENDPOINTS["commands"]["path"]}?${ENDPOINTS["commands"]["params"]}`,
        payload,
        params,
      );
      sleep(5);
      // Add comment
      params.tags.name = POST_PREFIX + ENDPOINTS["commandsAssist"]["path"];
      payload = JSON.stringify({
        query: "comment ",
        caret: 8,
        issues: [{ id: issueId }],
      });
      http.post(
        `${BASE_URL}/${API_PREFIX}${ENDPOINTS["commandsAssist"]["path"]}?${ENDPOINTS["commandsAssist"]["params"]}`,
        payload,
        params,
      );
      params.tags.name = POST_PREFIX + ENDPOINTS["commands"]["path"];
      payload = JSON.stringify({
        comment: comment,
        usesMarkdown: true,
        silent: false,
        prevCaret: 7,
        caret: 8,
        selection: 8,
        query: "comment ",
        focus: true,
        issues: [{ id: issueId }],
      });
      http.post(
        `${BASE_URL}/${API_PREFIX}${ENDPOINTS["commands"]["path"]}?${ENDPOINTS["commands"]["params"]}`,
        payload,
        params,
      );
    }
  }
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
    const topIssues = res.json().tree.map((item) => ({
      id: item.id,
    }));
    const payload = JSON.stringify(topIssues);
    params.tags.name = POST_PREFIX + ENDPOINTS["issuesGetter"]["path"];
    http.post(
      `${BASE_URL}/${API_PREFIX}${ENDPOINTS["issuesGetter"]["path"]}?${ENDPOINTS["issuesGetter"]["params"]}`,
      payload,
      params,
    );
    // View Issue
    sleep(3);
    const issueId = randomItem(topIssues).id.split("-")[1];
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
  testUpdateIssue();
  testViewIssue();
  //test_search();
}
