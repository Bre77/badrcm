#!/bin/bash
cd "${0%/*}"
OUTPUT="${1:-badrcm.spl}"
pnpm install
pnpm build
chmod -R u=rwX,go= stage/*
chmod -R u-x+X stage/*
chmod -R u=rwx,go= stage/bin/*
mv stage badrcm
tar -cpzf $OUTPUT --exclude=badrcm/.* --overwrite badrcm
rm -rf badrcm
