#!/bin/sh
set -e
for dir in common dispatcher worker regserver test; do
    (
        cd $dir
        npm install
    )
done
cd test
npm test
