const express = require("express");
const fetch = require("node-fetch");
const satellite = require("satellite.js");
const Bottleneck = require("bottleneck/es5");
const predict = require("./predict");
const cache = require("./cache");

const PORT = process.env.PORT || 3000;
const MS_PER_HOUR = 3600000;
const ISS_TRACK_INTERVAL_MS = 100;
const SATELLITE_DATA_API_URL = "https://celestrak.org";
const LOCATION_DATA_API_URL = "https://nominatim.openstreetmap.org";

const headers = {headers: {"User-Agent": "issviewer"}};
const limiter = new Bottleneck({
	maxConcurrent: 1,
	minTime: 1000
});

const app = express();
let tleData = [];
let issPosition = {};

app.use(express.static("./dist"));

function tleStringToArray(tleString)
{
	const arr = tleString.split("\n");
	return [arr[0], arr[1], arr[2]];
}

function tleArrayToString(arr)
{
	return `${arr[0]}\n${arr[1]}\n${arr[2]}`;
}

function updatePosition()
{
	if (tleData.length > 0)
		issPosition = getCurrentPosition();
}

// current position of the ISS
function getCurrentPosition()
{
	const satrec = satellite.twoline2satrec(tleData[1], tleData[2]);
	const posvel = satellite.propagate(satrec, new Date());
	const posEci = posvel.position;
	const gmst = satellite.gstime(new Date());
	const posGd = satellite.eciToGeodetic(posEci, gmst);

	const lat = satellite.degreesLat(posGd.latitude);
	const lon = satellite.degreesLong(posGd.longitude);
	const height = posGd.height;

	const data =
	{
		lat: Number(lat.toFixed(2)),
		lon: Number(lon.toFixed(2)),
		height: Number(height.toFixed(1)),
		velocityKmph: Math.round(eciVelocityToKmph(posvel.velocity))
	};

	return data;
}

async function startLoadTleData()
{
	try
	{
		const data = await cache.getTle();

		if (data != null)
		{
			var tleArray = tleStringToArray(data);
			var tleDay = Number(tleArray[1].substring(20, 32));
			var utcNowString = new Date().toUTCString();
			var utcNow = new Date(utcNowString);
			var diff = utcNow - new Date(utcNow.getFullYear(), 0, 0);
			var currentDay = diff / (1000*60*60*24);

			// check if cached TLE is recent enough
			if (currentDay - tleDay < 1)
			{
				console.log("cached TLE is recent enough and will be used");
				tleData = tleArray;
			} else
			{
				console.log("cached TLE is old and will be redownloaded");
				fetchTleData();
			}

		} else
		{
			console.log("TLE wasn't found in cache and will be downloaded");
			fetchTleData();
		}
	} catch (err)
	{
		console.error("Can't get TLE data: ", err);
	}
}

async function fetchTleData()
{
	try
	{
		const requestUrl = `${SATELLITE_DATA_API_URL}/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle`;
		const response = await fetch(requestUrl, headers);
		const fullTleFile = await response.text();
		tleData = tleStringToArray(fullTleFile);
		// cache TLE string
		cache.saveTle(tleArrayToString(tleData));

	} catch (err)
	{
		console.error("Can't get TLE data: ", err);
	}
}

function eciVelocityToKmph(velocity)
{
	return Math.sqrt(
		Math.pow(velocity.x * 3600, 2) + Math.pow(velocity.y * 3600, 2) + Math.pow(velocity.z * 3600, 2)
	);
}

// json response containing list of predictions and location data
async function predictResponse (req, res)
{
	try
	{
		const { locationName } = req.params;

		if (!locationName)
		{
			res.json({error: "location name was not provided"});
			return;
		}

		let location = await cache.getLocation(locationName);

		// location not in cache, download it
		if (location == null)
		{
			console.log("location is not in cache and will be downloaded");
			const requestUrl = encodeURI(`${LOCATION_DATA_API_URL}/search?format=json&q=${locationName}`);
			const response = await limiter.schedule(() =>
				fetch(requestUrl, headers)
			);
			const places = await response.json();

			if (places.length > 0)
			{
				location = places[0];
			} else
			{
				res.json({});
				return;
			}
		}

		const predictions = await predict.getPasses(tleData, location.lon, location.lat);
		const data =
		{
			location:
			{
				lon: location.lon,
				lat: location.lat
			},
			passes: predictions
		};

		// cache location data
		cache.saveLocation(locationName, data.location);
		res.json(data);

	} catch (err)
	{
		console.error("Can't get location data: ", err);
		res.status(500).send("Internal Server Error");
	}
}

app.get("/track", (req, res) =>
{
	res.json(issPosition);
});
app.get("/predict/:locationName", predictResponse);

app.listen(PORT, () =>
{
	console.log(`Listening on ${PORT}`);
});

startLoadTleData();
setInterval(fetchTleData, MS_PER_HOUR); // fetch new TLE hourly
setInterval(updatePosition, ISS_TRACK_INTERVAL_MS); // calculate and store current position periodically