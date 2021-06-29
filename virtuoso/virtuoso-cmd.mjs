const ls = require('ls');
const commander = require('commander');
const path = require('path');
const fs = require('fs');

let RED = '\x1b[31m';
let GREEN = '\x1b[32m';
let YELLOW = '\x1b[33m';
let NC = '\x1b[0m'; // No Color

function coloredLog(color, text, dst=process.stderr) {
  dst.write(`${color}${text}${NC}\n`);
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
    coloredLog(YELLOW, "Database is not ready to accept request. Trying again...");
    ++n;
    await $`sleep 1`;
  }
}

commander.option('-v, --verbose', 'Show detailed logs of execution', false)
  .option('-g, --graph-name [name_of_graph]', 'Name of graph to be loaded')
  .option('--down', 'Down docker components after execution', false)
  .argument('<data>', 'RDF data to be loaded')
  .argument('[query]', 'Query file (optional)')
  .parse(process.argv);

let spangDir = path.resolve(ls('./data/spang/')[0].full);

let srcPath = commander.args[1];
let queryPath = commander.args[2];

if(queryPath && !fs.existsSync(queryPath)) {
  coloredLog(RED, `Query file ${queryPath} is not found.`);
  process.exit(-1);
}

if(srcPath && !fs.existsSync(srcPath)) {
  coloredLog(RED, `Data file ${srcPath} is not found.`);
  process.exit(-1);
}
 
$.verbose = commander.opts().verbose;

let dir = path.dirname(srcPath);
let srcName = path.basename(srcPath);
coloredLog(YELLOW, `Preparing Containers (if not started)...`);
await $`SRC_DATA_DIR=${dir} docker-compose up -d db`;
coloredLog(YELLOW, `Removind all existing triples...`);
await tryUntilSucceed(`echo "DELETE FROM DB.DBA.RDF_QUAD;" | docker-compose exec -T db isql-v 1111 dba dba`, 100);
coloredLog(YELLOW, `Loading data...`);
$.verbose = true; // Temporary verbosity to show loading time
let graphName = commander.opts().graph ?? 'http://example.com/example.ttl';
await tryUntilSucceed(`echo "DB.DBA.TTLP_MT(file_to_string_output('/tmp/data/${srcName}'), '', '${graphName}', 0);" | docker-compose exec -T db isql-v 1111 dba dba`, 100);
console.log(''); // Newline
$.verbose = commander.opts().verbose; // Set verbosity again

if(queryPath) {
  await $`cp ${queryPath} ${spangDir}`;
  let queryName = path.basename(queryPath);
  coloredLog(YELLOW, `Executing spang...`);
  let result = await $`SPANG_DATA_DIR=${spangDir} docker-compose run spang spang2 --time -e http://db:8890/sparql /data/${queryName}`;
  console.log(result.stdout);
  let stderrLines = result.stderr.split("\n").filter(line => line.length > 0);
  if(stderrLines) {
    console.log(stderrLines[stderrLines.length - 1]); // Last line should be time of execution
  }
}

if(commander.opts().down) {
  coloredLog(YELLOW, `Let docker components down...`);
  await $`docker-compose down`;
}

coloredLog(GREEN, 'Done!');
