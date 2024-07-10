#!/bin/bash

# Check if cordova-plugin-moodleapp is in the list of plugins to be added
if [[ $CORDOVA_PLUGINS == *cordova-plugin-moodleapp* ]]; then
    echo "Building cordova-plugin-moodleapp"

    # Navigate to the directory containing the build.js script
    cd "$(dirname "$0")/../../cordova-plugin-moodleapp/scripts"

    # Run the build script using cross-env to ensure NODE_ENV is set correctly
    npx cross-env NODE_ENV=production node build.js
fi
