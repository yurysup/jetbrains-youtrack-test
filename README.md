# jetbrains-youtrack-test

## Work done
- Test users [creation](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/setup/users.js) using [Faker](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/setup/fake_users_data.py) data;
- 100_000 issues [created](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/setup/issues.js) using [Faker](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/setup/fake_issues.py) data;
- User simulation load tests (capacity & fixed-load) executed and analyzed;
- Task stages, performance analysis and answers for main questions posted in [report](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/reports/task_report.pdf);

## Installation
For data setup:
Install [Python 3](https://www.python.org/) v3.9+.
Install Python [Faker](https://faker.readthedocs.io/en/master/) dependency:
```
pip3 install Faker
```

For test execution:
Install [k6](https://k6.io/open-source/) v0.50.0+.

## Execution

To run performance test with live dashboard, execute `youtrack.js`:
```
K6_WEB_DASHBOARD=true k6 run youtrack.js
```

> :warning: **_NOTE:_**  Configure proper host at [hosts.js](https://github.com/yurysup/jetbrains-youtrack-test/blob/main/utils/hosts.js).

## Performance analysis & optimization

YouTrack ZIP local installation demonstrated capacity of ~280 concurrent users:
![capacity test](/reports/screenshots/Screenshot%202024-08-08%20at%2013.08.31.png)
