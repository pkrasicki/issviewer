const satellite = require("satellite.js");
const SunCalc = require("suncalc");

function iterate(tleData, lon, lat, passesArray, startDate, numIterations)
{
	const satrec = satellite.twoline2satrec(tleData[1], tleData[2]);
	const observerGd =
	{
		longitude: satellite.degreesToRadians(lon),
		latitude: satellite.degreesToRadians(lat),
		height: 0.370
	};

	var prevDate;
	var passId = passesArray.length;

	for (var i = 0; i < numIterations; i++)
	{
		startDate.setSeconds(startDate.getSeconds() + 30);
		const posvel = satellite.propagate(satrec, startDate);
		const posEci = posvel.position;
		const gmst = satellite.gstime(startDate);
		const posEcf = satellite.eciToEcf(posEci, gmst);
		const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);
		const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);
		const posGd = satellite.eciToGeodetic(posEci, gmst);

		if (elevationDeg > 10)
		{
			if (!prevDate)
			{
				prevDate = new Date(startDate.getTime());
			} else
			{
				// add 1h to prevDate. If startDate is bigger than means it's a new pass
				prevDate.setHours(prevDate.getHours() + 1);
				if (prevDate <= startDate)
					passId++;

				prevDate = new Date(startDate.getTime());
			}

			if (!passesArray[passId])
			{
				passesArray[passId] = {points: []};
			}

			var point =
			{
				date: startDate.toString(),
				lat: satellite.degreesLat(posGd.latitude),
				lon: satellite.degreesLong(posGd.longitude),
				elevation: Math.round(elevationDeg)
			};

			passesArray[passId].points.push(point);
		}
	}
}

module.exports =
{
	getPasses: function (tleData, lon, lat)
	{
		const numDays = 7; // number of days for the forecast
		var passes = [];
		var passDate = new Date();
		var endDate = new Date(passDate.getTime());
		endDate.setDate(endDate.getDate() + numDays - 1);
		var sunTimes;
		var numIterations;

		while (endDate > passDate)
		{
			sunTimes = SunCalc.getTimes(passDate, lat, lon);

			// make sure we only get predictions when the sky is dark enough
			if (passDate > sunTimes.dawn && passDate < sunTimes.dusk)
				passDate = new Date(sunTimes.dusk.getTime());

			sunTimes.dawn.setDate(sunTimes.dawn.getDate() + 1);
			// number of iterations until sky becomes bright again
			numIterations = Math.floor((sunTimes.dawn - passDate) / (1000 * 30));
			iterate(tleData, lon, lat, passes, passDate, numIterations);
		}

		// add additional information to each pass
		passes.forEach(pass =>
		{
			const startDate = new Date(pass.points[0].date);
			const endDate = new Date(pass.points[pass.points.length - 1].date);
			const maxPoint = pass.points.reduce((prev, cur) =>
				cur.elevation > prev.elevation ? cur : prev);
			pass.durationSeconds = (endDate - startDate) / (1000);
			pass.startDate = startDate.toString();
			pass.maxDate = maxPoint.date;
			pass.endDate = endDate.toString();
			pass.brightness = 0;
			pass.maxElevation = Math.round(maxPoint.elevation);
		});

		return passes;
	}
}