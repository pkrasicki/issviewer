const satellite = require("satellite.js");
const SunCalc = require("suncalc/suncalc"); // git version of suncalc
const ITERATE_SECONDS = 10;

function isSunlit(date, lon, lat, heightMeters)
{
	const lonDeg = satellite.radiansToDegrees(lon);
	const latDeg = satellite.radiansToDegrees(lat);
	const sunTimes = SunCalc.getTimes(date, latDeg, lonDeg, heightMeters);

	if (date > sunTimes.nightEnd && date < sunTimes.night)
		return true;
	else
		return false;
}

function iterate(tleData, lon, lat, passesArray, startDate, numIterations)
{
	const satrec = satellite.twoline2satrec(tleData[1], tleData[2]);
	const observerGd =
	{
		longitude: satellite.degreesToRadians(lon),
		latitude: satellite.degreesToRadians(lat),
		height: 0.370
	};

	let prevDate;
	let passId = passesArray.length;
	let pointIndex = 0;

	for (let i = 0; i < numIterations; i++)
	{
		startDate.setSeconds(startDate.getSeconds() + ITERATE_SECONDS);
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
				// add 1h to prevDate. If startDate is bigger that means it's a new pass
				prevDate.setHours(prevDate.getHours() + 1);
				if (prevDate <= startDate)
				{
					passId++;
					pointIndex = 0;
				}

				prevDate = new Date(startDate.getTime());
			}

			if (!passesArray[passId])
				passesArray[passId] = {points: []};

			const currentPass = passesArray[passId];
			const point =
			{
				date: startDate.toString(),
				lat: satellite.degreesLat(posGd.latitude),
				lon: satellite.degreesLong(posGd.longitude),
				elevation: Math.round(elevationDeg),
				sunlit: isSunlit(startDate, posGd.longitude, posGd.latitude, posGd.height * 1000)
			};

			currentPass.points.push(point);

			// add additional pass information
			if (pointIndex > 0)
			{
				if (point.elevation > currentPass.maxElevation)
				{
					currentPass.maxElevation = point.elevation;
					currentPass.maxDate = point.date;
				}

				let firstDate = new Date(currentPass.points[0].date);
				currentPass.endDate = point.date;
				currentPass.durationSeconds = Math.round((startDate - firstDate) / 1000);

				if (point.sunlit)
				{
					if (point.elevation > currentPass.visible.maxElevation)
					{
						currentPass.visible.maxElevation = point.elevation;
						currentPass.visible.maxDate = point.date;
					}

					if (!currentPass.sunlit)
					{
						currentPass.sunlit = true;
						currentPass.visible.startDate = point.date;
					}

					currentPass.visible.endDate = point.date;
					let visibleStartDate = new Date(currentPass.visible.startDate);
					let visibleEndDate = new Date(currentPass.visible.endDate);
					currentPass.visible.durationSeconds = Math.round((visibleEndDate - visibleStartDate) / 1000);
				}

			} else if (pointIndex == 0)
			{
				currentPass.startDate = point.date;
				currentPass.maxElevation = point.elevation;
				currentPass.maxDate = point.date;
				currentPass.endDate = point.date;
				currentPass.durationSeconds = 0;

				if (point.sunlit)
					currentPass.sunlit = true;
				else
					currentPass.sunlit = false;

				currentPass.visible =
				{
					startDate: point.date,
					maxElevation: point.elevation,
					maxDate: point.date,
					endDate: point.date,
					durationSeconds: ITERATE_SECONDS
				};
			}

			pointIndex++;
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
			if (passDate > sunTimes.dawn && passDate < sunTimes.sunset)
				passDate = new Date(sunTimes.sunset.getTime());

			sunTimes.dawn.setDate(sunTimes.dawn.getDate() + 1);
			// number of iterations until sky becomes bright again
			numIterations = Math.floor((sunTimes.dawn - passDate) / (1000 * ITERATE_SECONDS));
			iterate(tleData, lon, lat, passes, passDate, numIterations);
		}

		return passes.filter(pass => pass.sunlit === true);
	}
}