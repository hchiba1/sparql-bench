const ls = require('ls');
const commander = require('commander');
const path = require('path');
const fs = require('fs');

let RED = '\x1b[31m';
let GREEN = '\x1b[32m';
let YELLOW = '\x1b[33m';

function coloredLog(color, text) {
  let NC = '\x1b[0m'; // No Color
  console.log(`${color}${text}${NC}`);
};


async function tryUntilSucceed(command, trialNum) {
  let n = 0;
  while(n < trialNum) {
    try {
      await $([command]);
      break;
    } catch (p) {
      // do nothing
    }
    coloredLog(YELLOW, "Try again...");
    ++n;
    await $`sleep 1`;
  }
}

commander.option('-v,--verbose', 'Show detailed logs of execution', false).arguments('[JSON]').parse(process.argv);

if(commander.args.length < 1)
  commander.help();
let spangDir = path.resolve(ls('./data/spang/')[0].full);

let jsonPath = commander.args[1];

$.verbose = commander.opts().verbose;

let testCases = JSON.parse(await $`cat ${jsonPath}`);

coloredLog(GREEN, `Loaded test cases: ${JSON.stringify(testCases, null, 2)}`);

process.chdir(path.dirname(jsonPath));

for(let testCase of testCases) {
  coloredLog(YELLOW, `Started to benchmark test case ${JSON.stringify(testCase)}`);
  let data = ls(testCase.data);
  if(data.length == 0) {
    coloredLog(RED, `"${testCase.data} is not found`);
  }
  else if(data.length == 1) {
    let dir = path.dirname(data[0].full);
    let fileName = path.basename(data[0].full);
    coloredLog(YELLOW, `Creating Container...`);
    await $`SRC_DATA_DIR=${dir} docker-compose up -d db`;
    coloredLog(YELLOW, `Loading data...`);
    await tryUntilSucceed(`echo "DB.DBA.TTLP_MT(file_to_string_output('/usr/local/virtuoso-opensource/var/lib/virtuoso/db/${fileName}'), '', 'http://example.com/example.ttl', 0);" | docker-compose exec -T db isql-v 1111 dba dba`, 100);
    let testQueries = Array.isArray(testCase.query) ? testCase.query : [testCase.query];
    let queryNames = [];
    for(let queryPath of testQueries) {
      for(let eachQuery of ls(queryPath)) {
        await $`cp ${eachQuery.full} ${spangDir}`;
        const defaultExpectedName = eachQuery.full.replace(/\.[^/.]+$/, '') + '.txt';
        if(fs.existsSync(defaultExpectedName))
          await $`cp ${defaultExpectedName} ${spangDir}`;
        queryNames.push('/data/' + path.basename(eachQuery.full));
      }
    }
    coloredLog(YELLOW, `Benchmarking by spang-bench...`);
    let result = await $`SPANG_DATA_DIR=${spangDir} docker-compose run spang spang-bench -e http://db:8890/sparql ${queryNames} 2> /dev/null`;
    coloredLog(GREEN, result);
    coloredLog(YELLOW, `Removing container...`);
    await $`docker-compose down`;
  }
}

coloredLog(GREEN, 'Done!');
