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
const UPDATE_ISSUE = "/issues";
const VIEW_ISSUE = "/issues";
const SEARCH = "/issues";
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
const RAMP_UP = getEnvVar("RAMP_UP", "60s");
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
    create_issue: {
      executor: "ramping-arrival-rate",
      exec: "test_create_issue",
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
      exec: "test_view_issue",
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
    [`http_req_duration{name:${CREATE_ISSUE}}`]: ["p(90)<1000"],
    [`http_req_duration{name:${UPDATE_ISSUE}}`]: ["p(90)<1000"],
    [`http_req_duration{name:${VIEW_ISSUE}}`]: ["p(90)<500"],
    [`http_req_duration{name:${SEARCH}}`]: ["p(90)<500"],
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
}

export function test_update_issue() {
  sleep(1);
}

export function test_view_issue() {
  sleep(1);
}

export function test_view_issues() {
  // GET /api/users/me?$top=-1
  // GET /api/admin/timeTrackingSettings/workTimeSettings?fields=minutesADay,minutesADayPresentation,workDays,firstDayOfWeek,daysAWeek
  // GET /hub/api/rest/settings/public?fields=helpdeskEnabled
  // GET /api/users/me/profiles/grazie?fields=hasMoreTokens,enabled,excludedIssueTypes,cycleRestart,enableSpellChecker,spellCheckerEnabledInSystem,freeLicense
  // GET /api/admin/globalSettings?fields=restSettings(allowAllOrigins,allowedOrigins),imageTextRecognitionSettings(enabled),systemSettings(ocrSupported)
  // GET /api/admin/widgets/general?fields=id,key,appId,description,appName,name,collapsed,indexPath,extensionPoint(),iconPath,appIconPath,expectedHeight,expectedWidth
  // GET /api/permissions/cache?fields=global,permission(key),projects(id)
  // GET /api/users/me/profiles/questionnaire?fields=show
  // GET /api/filterFields?$top=-1&fields=$type,id,name,customField(id,name,ordinal,aliases,localizedName,fieldType(id,presentation,isBundleType,valueType,isMultiValue))&getUnusedVisibleFields=true&fieldTypes=custom&query=
  // GET /api/users/me/recent/issues?fields= (with many params)
  // GET /api/users/me/recent/articles?fields=
  // GET /api/search/assist?fields=
  // !!! GET /api/sortedIssues?topRoot=100&skipRoot=0&flatten=true&query=&fields=tree(id,summaryTextSearchResult(highlightRanges(startOffset,endOffset)))
  // GET /api/savedQueries?fields=id,issuesUrl,name,query,pinned,pinnedInHelpdesk,isUpdatable,isDeletable,isShareable,owner(id,ringId,login,name,email,isEmailVerified,guest,fullName,avatarUrl,online,banned,banBadge,canReadProfile,isLocked,userType(id))&sort=true&$top=-1
  // x8 GET /api/filterFields/project/values?$top=-1&fields=id,presentation,query&prefix=&query=&type=Issue
  // !!! POST /api/issuesGetter?$top=-1&$skip=0&fields= (top 100 ids payload)
  // POST /api/issuesGetter/counts?fields=counts(folder(id),count)
  // POST /api/issuesGetter/count?fields=folder(id),count
  // POST /api/issueListSubscription?fields=ticket (top 100 ids payload)
}

export function test_search() {
  sleep(1);
}

export default function () {
  test_create_issue();
  test_update_issue();
  test_view_issue();
  test_search();
}
