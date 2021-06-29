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

commander.option('-v, --verbose', 'Show detailed logs of execution', false).
  option('-d, --data [DATA]', 'RDF data source file to be queried').
  arguments('[QUERY]').parse(process.argv);

if(commander.args.length < 2)
  commander.help();
let spangDir = path.resolve(ls('./data/spang/')[0].full);

let queryPath = commander.args[1];
let srcPath = commander.opts().data;

if(!fs.existsSync(queryPath)) {
  coloredLog(RED, `Query file ${queryPath} is not found.`);
  process.exit(-1);
}

if(!fs.existsSync(srcPath)) {
  coloredLog(RED, `Data file ${srcPath} is not found.`);
  process.exit(-1);
}
 
 
$.verbose = commander.opts().verbose;

let dir = path.dirname(srcPath);
let srcName = path.basename(srcPath);
coloredLog(YELLOW, `Creating Container...`);
await $`SRC_DATA_DIR=${dir} docker-compose up -d db`;
coloredLog(YELLOW, `Loading data...`);
await tryUntilSucceed(`echo "DB.DBA.TTLP_MT(file_to_string_output('/tmp/data/${srcName}'), '', 'http://example.com/example.ttl', 0);" | docker-compose exec -T db isql-v 1111 dba dba`, 100);

await $`cp ${queryPath} ${spangDir}`;
let queryName = path.basename(queryPath);
coloredLog(YELLOW, `Benchmarking by spang-bench...`);
let result = await $`SPANG_DATA_DIR=${spangDir} docker-compose run spang spang2 -e http://db:8890/sparql /data/${queryName} 2> /dev/null`;
coloredLog(GREEN, result);
coloredLog(YELLOW, `Removing container...`);
await $`docker-compose down`;

coloredLog(GREEN, 'Done!');
