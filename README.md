Track the International Space Station and get pass predictions.

![screenshot](screenshot.png?raw=true)

Shows pass predictions on a map for a given city. Currently a pass will be shown even if ISS is in Earth's shadow. That means some of the listed passes will not be visible to you. It might get fixed in the future.

## Dependencies
- [Redis server](https://redis.io) - used as a cache for API requests.
- [SunCalc](https://github.com/mourner/suncalc) from Git master branch (version 1.8.0 is too old):
```
cd issviewer
git clone https://github.com/mourner/suncalc suncalc
```

## Building
```
npm install
npm run build
```

Make sure redis-server is running (otherwise the app will exit with an error).
Run the app:
`node app.js`