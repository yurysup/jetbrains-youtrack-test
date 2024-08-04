import http from "k6/http";
import { SharedArray } from "k6/data";
import { scenario } from "k6/execution";
import { sleep } from "k6";
import { HOSTS } from "../utils/hosts.js";
import papaparse from "../utils/papaparse.min.js";
import { getEnvVar } from "../utils/utils.js";

// Parameters setup
const ENV_ = getEnvVar("ENV", "local");
const BASE_URL = getEnvVar("BASE_URL", HOSTS[ENV_]);
const FEEDS_DIR = "../feeds";
const HUB_API_PREFIX = "hub/api/rest";
const PERMANENT_TOKEN = getEnvVar("TOKEN", "NOT_PASSED");
const CREATE_USER = "/users";
const ADD_TOKEN = "/permanenttokens";
const HTTP_TIMEOUT = "10s"; // override default timeout 60s
//const ITERATIONS = 1;
const VUS = 1;

// YouTrack parameters
//const YOUTRACK_SERVICE_ID = "ef71eae4-3405-49a5-be22-9517eeac46f2";
const YOUTRACK_SERVICE_ID = "1499eb36-a7a4-4759-b300-1b4c0ca0de46";
const HUB_SERVICE_ID = "0-0-0-0-0";

/*
 * Not using SharedArray here will mean that the code in the function call (that is what loads and
 * parses the csv) will be executed per each VU which also means that there will be a complete copy per each VU.
 *
 * Load CSV file and parse it using Papa Parse.
 */
const users = new SharedArray("users", function () {
  return papaparse.parse(open(`${FEEDS_DIR}/users.csv`), { header: false })
    .data;
});

export const options = {
  tags: {
    env: ENV_,
  },
  scenarios: {
    users: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: users.length,
      maxDuration: "10m",
    },
  },
  // Thresholds defined for specific requests will appear in summary output.
  thresholds: {
    http_req_failed: ["rate < 0.01"],
  },
};

export function create_user() {
  const user = users[scenario.iterationInTest];
  const email = user[0];
  const username = user[1];
  const params = {
    tags: { name: CREATE_USER },
    timeout: HTTP_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PERMANENT_TOKEN}`,
    },
  };
  const payload = JSON.stringify({
    details: [
      {
        type: "EmailuserdetailsJSON",
        email: {
          type: "EmailJSON",
          verified: true,
          email: email,
        },
        password: {
          type: "PlainpasswordJSON",
          value: "$youtrack123",
        },
        passwordChangeRequired: false,
      },
    ],
    name: username,
  });
  const res = http.post(
    `${BASE_URL}/${HUB_API_PREFIX}/users?failOnPermissionReduce=true&fields=id`,
    payload,
    params,
  );
  const user_id = res.json().id;
  if (user_id) {
    const params = {
      tags: { name: ADD_TOKEN },
      timeout: HTTP_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PERMANENT_TOKEN}`,
      },
    };
    const payload = JSON.stringify({
      scope: [
        {
          id: YOUTRACK_SERVICE_ID,
          key: YOUTRACK_SERVICE_ID,
          label: "YouTrack",
          data: {
            type: "service",
            id: YOUTRACK_SERVICE_ID,
            name: "YouTrack",
            applicationName: "YouTrack",
          },
        },
        {
          id: HUB_SERVICE_ID,
          key: HUB_SERVICE_ID,
          label: "YouTrack Administration",
          data: {
            type: "service",
            id: YOUTRACK_SERVICE_ID,
            name: "YouTrack Administration",
            applicationName: "Hub",
          },
        },
      ],
      name: username,
    });
    const res = http.post(
      `${BASE_URL}/${HUB_API_PREFIX}/users/${user_id}/permanenttokens/?failOnPermissionReduce=true&fields=token`,
      payload,
      params,
    );
    const token = res.json().token;
    console.log(token);
    sleep(1);
  }
}

export default function () {
  create_user();
}
