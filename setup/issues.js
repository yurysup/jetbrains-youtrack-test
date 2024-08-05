import http from "k6/http";
import { SharedArray } from "k6/data";
import { HOSTS } from "../utils/hosts.js";
import papaparse from "../utils/papaparse.min.js";
import { getEnvVar, randomItem, randomString } from "../utils/utils.js";
import { sleep } from "k6";

// Parameters setup
const ENV_ = getEnvVar("ENV", "remote");
const BASE_URL = getEnvVar("BASE_URL", HOSTS[ENV_]);
const FEEDS_DIR = "../feeds";
const API_PREFIX = "api";
const CREATE_ISSUE = "/issues";
const HTTP_TIMEOUT = "10s"; // override default timeout 60s
// Load rates
const TIME_UNIT = "1m"; // load rates to be set per minute (RPM)
const VUS = 50;
// Load Profile
const RAMP_UP = getEnvVar("RAMP_UP", "600s");
const HOLD_RATE = getEnvVar("HOLD_RATE", "60s");
const TEAR_DOWN = getEnvVar("TEAR_DOWN", "60s");

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
    // create_issues: {
    //   executor: "ramping-vus",
    //   exec: "test_create_issue",
    //   startVUs: 0,
    //   stages: [
    //     { target: VUS, duration: RAMP_UP },
    //     { target: 0, duration: TEAR_DOWN },
    //   ],
    // },
    create_100k_issues: {
      executor: "shared-iterations",
      vus: 35,
      iterations: 100000,
      maxDuration: "180m",
    },
  },
  // Thresholds defined for specific requests will appear in summary output.
  thresholds: {
    [`http_req_duration{name:${CREATE_ISSUE}}`]: ["p(95)<2000"],
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

export function test_create_issue() {
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
  sleep(1);
}

export default function () {
  test_create_issue();
}
