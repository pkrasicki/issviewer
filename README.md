Track the International Space Station and get pass predictions.

![screenshot](screenshot.png?raw=true)

ISS Viewer predicts visible ISS passes for a given location and displays them on a map. You can also view the station's position in real time.

## Dependencies
- [Node.js](https://nodejs.org)
- [Npm](https://www.npmjs.com)
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

Run the app:
```
node app.js
```

It will create a server on localhost:3000. Make sure redis-server is running (otherwise the app will exit with an error).

Live version is at: [issviewer.com](https://issviewer.com)