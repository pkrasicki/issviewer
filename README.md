Track the International Space Station and get pass predictions.

![screenshot](screenshot.png?raw=true)

Shows pass predictions on a map for a given city. Currently a pass will be shown even if ISS is in Earth's shadow. That means some of the listed passes will not be visible to you. It might get fixed in the future.

## Dependencies
To run this project you need to install a [Redis server](https://redis.io). It is used as a cache for API requests.

## Building
```
npm install
npm run build
```

Make sure redis-server is running (otherwise the app will exit with an error). Then you can run the app: `node app.js`