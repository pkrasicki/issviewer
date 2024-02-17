# ISS Viewer
Track the International Space Station and get pass predictions.

![screenshot](screenshot.png?raw=true)

![screenshot 2](screenshot2.png?raw=true)

ISS Viewer predicts visible ISS passes for a given location and displays them on a map. It can also calculate and display the station's position in real time.

The app periodically fetches orbital information about ISS from [celestrak.org](https://celestrak.org). The [PyEphem](https://github.com/brandon-rhodes/pyephem) library is then used to predict future passes based on this data and [Satellite.js](https://github.com/shashwatak/satellite-js) is used for calculating the current position.

## Dependencies
- [Node.js 18.x](https://nodejs.org)
- [Redis server](https://redis.io) - used as a cache for API requests.
- [Python 3](https://www.python.org)
- [PyEphem](https://github.com/brandon-rhodes/pyephem)

On Debian GNU/Linux they can be quickly installed by running:
```
sudo apt install nodejs npm redis python3-ephem
```

## Build from source
```
npm install
npm run build
```

For a production build use `npm run build-prod`.

# Run
Make sure redis-server is running (otherwise the app will exit with an error) and run `node app.js` to start the app. Then navigate to `http://localhost:3000`.

For development you can instead run `npx nodemon app.js`. This will restart the backend automatically on changes.

Live version is at: [issviewer.com](https://issviewer.com)