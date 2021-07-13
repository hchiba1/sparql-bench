#!/usr/bin/env zx

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

if(process.argv[1].endsWith('zx')) {
  process.argv.shift();
  process.argv[0] = 'node';
}

commander.option('-v, --verbose', 'Show detailed logs of execution', false)
  .option('-g, --graph-name [name_of_graph]', 'Name of graph to be loaded')
  .option('--down', 'Down docker components after execution', false)
  .option('-t, --tag [docker_image_tag]', 'Specify tag of docker image', 'latest')
  .argument('<data>', 'RDF data to be loaded')
  .argument('[query]', 'Query file (optional)')
  .showHelpAfterError()
  .parse(process.argv);

let spangDir = path.resolve(ls('./data/spang/')[0].full);

let srcPath = commander.args[0];
let queryPath = commander.args[1];

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
let tag = commander.opts().tag;
let currentTag = null;
try {
  let imageLine = await $`docker image ls --no-trunc | grep  $(docker-compose images -q db)`;
  currentTag = imageLine.stdout.split(' ').filter(elem => elem)[1];
} catch(e) {
  // do nothing
}

let srcName = path.basename(srcPath);
if(currentTag != tag) {
  coloredLog(YELLOW, `The tag is changed. Recreation of db is needed...`);
  await $`rm -rf ./data/virtuoso/*`;
  await $`VIRTUOSO_IMAGE_TAG=${tag} SRC_DATA_DIR=${dir} docker-compose up --force-recreate -d db`;
} else {
  coloredLog(YELLOW, `Preparing Containers (if not started)...`);
  await $`VIRTUOSO_IMAGE_TAG=${tag} SRC_DATA_DIR=${dir} docker-compose up -d db`;
}
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

