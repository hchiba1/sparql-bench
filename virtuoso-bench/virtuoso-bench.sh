#! /bin/bash

# Color
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

function red {
    printf "${RED}$@${NC}\n"
}

function green {
    printf "${GREEN}$@${NC}\n"
}

function yellow {
    printf "${YELLOW}$@${NC}\n"
}

function usage_exit() {
    echo "Usage: $0 [-v virtuoso_image_tag] [-d data] queries ..." 1>&2
    exit 1
}

function try() {
    local n=0
    echo $1
    until [ "$n" -ge $2 ]
    do
        eval $1 && break  # substitute your command here
        echo $(yellow Try again...)
        n=$((n+1)) 
        sleep 1
    done
}

while getopts v:d:h OPT
do
    case $OPT in
        v)  VIRTUOSO_IMAGE_TAG=$OPTARG
            ;;
        d)  SRC=$OPTARG
            ;;
        h)  usage_exit
            ;;
        \?) usage_exit
            ;;
    esac
done

shift $((OPTIND - 1))

rm -rf ./data/virtuoso/*

cp $SRC ./data/virtuoso/
SRC=`basename $SRC`
QUERIES=''

for arg in $@ ;
do
  cp $arg ./data/spang/
  QUERIES="$QUERIES /data/`basename $arg`"
done
echo;
echo $(yellow Start to initialize database...)
VIRTUOSO_IMAGE_TAG=$VIRTUOSO_IMAGE_TAG docker-compose up -d db
try "echo \"DB.DBA.TTLP_MT(file_to_string_output('/usr/local/virtuoso-opensource/var/lib/virtuoso/db/$SRC'), '', 'http://example.com/example.ttl', 0);\" | docker-compose exec -T db isql-v 1111 dba dba" 10
echo;
echo $(yellow Start test...)
docker-compose run spang-test spang-test -e http://db:8890/sparql $QUERIES
echo;
echo $(yellow Done!)
