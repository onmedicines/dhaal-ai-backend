#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Force Puppeteer to download the browser.
# This command is from Puppeteer's official docs for this exact scenario.
npx puppeteer browsers install chrome

