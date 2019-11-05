import "../css/main.css";
import "../../node_modules/leaflet/dist/leaflet.css";
import "leaflet";
import "../images/logo.png";

const startPos = [51.505, -0.09];
const headingDateFormat = {day: "2-digit", month: "long", year: "numeric"};
const liTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short"};
const detailsDateFormat = {day: "2-digit", month: "short", year: "numeric"};
const detailsTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit"};
const headers = {headers: {"User-Agent": "issviewer"}};
var map = L.map("map");
var passes = {};
var marker;
var polyline;

async function updateISSPosition(table)
{
	try
	{
		const response = await fetch("track", headers);
		const coords = await response.json();
		marker.setLatLng([coords.lat, coords.lon]);
		map.setView([coords.lat, coords.lon]);
		updateOrbitInfo(table, coords.lat, coords.lon, coords.height, coords.velocityKmph);
	} catch (err)
	{
		console.error("Can't get current ISS position: ", err);
	}
}

function updateOrbitInfo(table, lon, lat, height, velocityKmph)
{
	table.querySelector("#orbit-h").innerHTML = height + " km";
	table.querySelector("#orbit-vel").innerHTML = velocityKmph + " km/h";
	table.querySelector("#orbit-lon").innerHTML = lon;
	table.querySelector("#orbit-lat").innerHTML = lat;
}

function enableSpinner()
{
	document.querySelector(".spinner").style.visibility = "visible";
}

function disableSpinner()
{
	document.querySelector(".spinner").style.visibility = "hidden";
}

async function locationInputChange(e)
{
	try
	{
		enableSpinner();
		const locationName = e.target.value;
		const response = await fetch(`predict/${locationName}`, headers);
		passes = await response.json();

		// location not found
		if (typeof passes != "object" || Object.keys(passes).length === 0)
			return;

		drawCityMarker(locationName);
		updateSightingsList();
		map.setView([passes.location.lat, passes.location.lon]);
		document.querySelector("#location").scrollIntoView();
	} catch (err)
	{
		console.error("Can't get predictions: ", err);
	} finally
	{
		disableSpinner();
	}
}

function drawCityMarker(locationName)
{
	if (marker)
		marker.remove();

	marker = L.marker([passes.location.lat, passes.location.lon],
	{
		title: locationName,
		alt: locationName
	}).addTo(map);
}

function createSightingListItem(time, duration, maxElevation, passId)
{
	var li = document.createElement("li");

	var timeSpan = document.createElement("span");
	timeSpan.classList.add("date");
	timeSpan.innerHTML = time;
	
	var durationSpan = document.createElement("span");
	durationSpan.classList.add("duration");
	durationSpan.innerHTML = duration;
	
	var maxElevationSpan = document.createElement("span");
	maxElevationSpan.classList.add("max-elevation");
	maxElevationSpan.innerHTML = maxElevation + "&deg;";

	li.dataset.passId = passId;

	li.appendChild(timeSpan);
	li.appendChild(durationSpan);
	li.appendChild(maxElevationSpan);
	li.addEventListener("click", sightingItemClick);

	return li;
}

function dateToTimeZoneName(date)
{
	var dateString = date.toLocaleTimeString(undefined, {timeZoneName: "short"});
	var splitArray = dateString.split(" ");
	return splitArray[splitArray.length - 1];
}

function updateSightingDetails(selectedPass)
{
	const startDate = new Date(selectedPass.startDate);
	const maxDate = new Date(selectedPass.maxDate);
	const endDate = new Date(selectedPass.endDate);

	document.getElementById("detail-date").innerHTML = startDate.toLocaleDateString(undefined, detailsDateFormat);
	document.getElementById("detail-tz-name").innerHTML = `Time (${dateToTimeZoneName(startDate)})`;
	document.getElementById("detail-time-start").innerHTML = startDate.toLocaleTimeString(undefined, detailsTimeFormat);
	document.getElementById("detail-time-max").innerHTML = maxDate.toLocaleTimeString(undefined, detailsTimeFormat);
	document.getElementById("detail-time-end").innerHTML = endDate.toLocaleTimeString(undefined, detailsTimeFormat);
	document.getElementById("detail-alt-start").innerHTML = selectedPass.points[0].elevation + "&deg;";
	document.getElementById("detail-alt-max").innerHTML = selectedPass.maxElevation + "&deg;";
	document.getElementById("detail-alt-end").innerHTML = selectedPass.points[selectedPass.points.length - 1].elevation + "&deg;";
}

function sightingItemClick(e)
{
	var items = document.querySelectorAll(".sightings-list ul > li");
	items.forEach(item => item.classList.remove("selected")); // remove previous selection
	e.currentTarget.classList.add("selected");

	const selectedPass = passes.passes[e.currentTarget.dataset.passId];
	drawPassOnMap(selectedPass.points);
	updateSightingDetails(selectedPass);
}

function durationToString(duration)
{
	if (duration < 60)
	{
		return `${duration} s`;
	} else
	{
		const minutes = Math.floor(duration / 60);
		const seconds = duration % 60;

		return `${minutes} min ${seconds} s`;
	}
}

function updateSightingsList()
{
	const sightings = passes.passes;
	const sightingsDiv = document.querySelector(".sightings");
	const sightingsListDiv = document.querySelector(".sightings-list");
	const locationInfo = document.querySelector(".location-info");

	locationInfo.style.display = "none";
	sightingsDiv.style.display = "flex";

	// clear the list first
	while (sightingsListDiv.firstChild)
	{
		sightingsListDiv.removeChild(sightingsListDiv.firstChild);
	}

	var prevDay;
	var firstLiElement;
	sightings.forEach((pass, index) =>
	{
		var isDifferentDay = false;
		if (!prevDay || prevDay != new Date(pass.startDate).getDate())
		{
			prevDay = new Date(pass.startDate).getDate();
			isDifferentDay = true;
		}

		const timeString = new Date(pass.startDate).toLocaleTimeString(undefined, liTimeFormat);
		const durationString = durationToString(pass.durationSeconds);
		const maxElevationString = pass.maxElevation;
		const liElement = createSightingListItem(timeString, durationString, maxElevationString, index);

		if (index == 0)
			firstLiElement = liElement;

		// separate sightings by day
		if (isDifferentDay)
		{
			var heading = document.createElement("h4");
			heading.innerHTML = new Date(pass.startDate).toLocaleDateString(undefined, headingDateFormat);

			var ul = document.createElement("ul");
			ul.appendChild(liElement);
			sightingsListDiv.appendChild(heading);
			sightingsListDiv.appendChild(ul);

		} else
		{
			sightingsListDiv.querySelector("ul:last-child").appendChild(liElement);
		}
	});

	// automatically select first element on the list
	firstLiElement.click();
}

function drawPassOnMap(pass)
{
	const coordsArray = pass.map(value => [value.lat, value.lon]);

	if (polyline)
		polyline.remove();

	// TODO use line color rgb(255, 75, 50) for visible points (where satellite is sunlit)
	polyline = L.polyline(coordsArray).addTo(map);
}

window.addEventListener("load", () =>
{
	const tracking = document.querySelector("main.tracking");

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	{
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	if (!tracking)
	{
		const locationInput = document.querySelector("#location");
		locationInput.value = ""; // clear input on refresh
		locationInput.addEventListener("change", locationInputChange);
		map.setView(startPos, 4);
		
	} else if(tracking)
	{
		const table = document.querySelector(".orbit-table");

		map.setView(startPos, 3);
		marker = L.marker(startPos,
		{
			title: "ISS",
			alt: "ISS"
		}).addTo(map);

		setInterval(() =>
		{
			updateISSPosition(table);
		}, 100);
	}
});