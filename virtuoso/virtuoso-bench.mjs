const ls = require('ls');
const commander = require('commander');
const path = require('path');

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
      await $`command`;
      break;
    } catch (p) {
      // do nothing
    }
    yellow("Try again...");
    ++n;
    await $`sleep 1`;
  }
}

commander.arguments('[JSON]').parse(process.argv);

if(commander.args.length < 1)
  commander.help();
let spangDir = path.resolve(ls('./data/spang/')[0].full);

let jsonPath = commander.args[1];

let testCases = JSON.parse(await $`cat ${jsonPath}`);

process.chdir(path.dirname(jsonPath));


for(let testCase of testCases) {
  let data = ls(testCase.data);
  if(data.length == 1) {
    let dir = path.dirname(data[0].full);
    let fileName = path.basename(data[0].full);
    await $`SRC_DATA_DIR=${dir} docker-compose up -d db`;
    await tryUntilSucceed(`echo "DB.DBA.TTLP_MT(file_to_string_output('/usr/local/virtuoso-opensource/var/lib/virtuoso/db/${fileName}'), '', 'http://example.com/example.ttl', 0);" | docker-compose exec -T db isql-v 1111 dba dba`, 10);
    let testQueries = Array.isArray(testCase.query) ? testCase.query : [testCase.query];
    let queryNames = [];
    for(let queryPath of testQueries) {
      // TODO: execute spang-bench
      for(let eachQuery of ls(queryPath)) {
        await $`cp ${eachQuery.full} ${spangDir}`;
        queryNames.push('/data/' + path.basename(eachQuery.full));
      }
    }
    await $`docker-compose run spang spang-bench -e http://db:8890/sparql ${queryNames}`;
    await $`docker-compose down`;
  }
}

coloredLog(GREEN, 'Done!');
