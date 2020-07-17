import "../css/main.css";
import "../../node_modules/leaflet/dist/leaflet.css";
import "../../node_modules/leaflet/dist/images/marker-shadow.png";
import "../../node_modules/leaflet/dist/images/marker-icon-2x.png";
import "leaflet";
import "../images/logo.png";

const startPos = [51.505, -0.09];
const headingDateFormat = {day: "2-digit", month: "long", year: "numeric"};
const liTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short"};
const detailsDateFormat = {day: "2-digit", month: "short", year: "numeric"};
const detailsTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit"};
const headers = {headers: {"User-Agent": "issviewer"}};
const LINE_SUNLIT_COLOR = "rgb(255, 42, 42)";
const LINE_DARK_COLOR = "rgba(72, 72, 255, 0.7)";
let map = L.map("map");
let passes = {};
let locationMarker;
let startMarker;
let endMarker;
let polylineSunlit;
let polylineDark;

async function updateISSPosition(table)
{
	try
	{
		const response = await fetch("track", headers);
		const coords = await response.json();
		locationMarker.setLatLng([coords.lat, coords.lon]);
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

function showSpinner()
{
	document.querySelector(".spinner").style.visibility = "visible";
}

function hideSpinner()
{
	document.querySelector(".spinner").style.visibility = "hidden";
}

async function locationInputChange(e)
{
	try
	{
		showSpinner();
		const locationName = e.target.value;
		const response = await fetch(`predict/${locationName}`, headers);
		passes = await response.json();

		// location not found
		if (typeof passes != "object" || Object.keys(passes).length === 0)
			return;

		drawLocationMarker(locationName);
		updateSightingsList();
		map.setView([passes.location.lat, passes.location.lon]);
		document.querySelector("#location").scrollIntoView();
	} catch (err)
	{
		console.error("Can't get predictions: ", err);
	} finally
	{
		hideSpinner();
	}
}

function drawLocationMarker(locationName)
{
	if (locationMarker)
		locationMarker.remove();

	locationMarker = L.marker([passes.location.lat, passes.location.lon],
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
	const startDate = new Date(selectedPass.visible.startDate);
	const maxDate = new Date(selectedPass.visible.maxDate);
	const endDate = new Date(selectedPass.visible.endDate);

	document.getElementById("detail-date").innerHTML = startDate.toLocaleDateString(undefined, detailsDateFormat);
	document.getElementById("detail-tz-name").innerHTML = `Time (${dateToTimeZoneName(startDate)})`;
	document.getElementById("detail-time-start").innerHTML = startDate.toLocaleTimeString(undefined, detailsTimeFormat);
	document.getElementById("detail-time-max").innerHTML = maxDate.toLocaleTimeString(undefined, detailsTimeFormat);
	document.getElementById("detail-time-end").innerHTML = endDate.toLocaleTimeString(undefined, detailsTimeFormat);

	let firstVisiblePoint;
	for (let i = 0; i < selectedPass.points.length; i++)
	{
		if (selectedPass.points[i].visible)
		{
			firstVisiblePoint = selectedPass.points[i];
			break;
		}
	}

	let lastVisiblePoint;
	for (let i = selectedPass.points.length - 1; i > -1; i--)
	{
		if (selectedPass.points[i].visible)
		{
			lastVisiblePoint = selectedPass.points[i];
			break;
		}
	}

	document.getElementById("detail-alt-start").innerHTML = firstVisiblePoint.elevation + "&deg;";
	document.getElementById("detail-alt-max").innerHTML = selectedPass.visible.maxElevation + "&deg;";
	document.getElementById("detail-alt-end").innerHTML = lastVisiblePoint.elevation + "&deg;";
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
	const minutes = Math.floor(duration / 60);
	const seconds = duration % 60;
	let durationString = `${minutes} min ${seconds} s`;

	if (minutes == 0)
		durationString = `${duration} s`;
	else if (seconds == 0)
		durationString = `${minutes} min`;

	return durationString;
}

function updateSightingsList()
{
	const sightings = passes.passes;
	const sightingsDiv = document.querySelector(".sightings");
	const sightingsListDiv = document.querySelector(".sightings-list");
	const locationInfo = document.querySelector(".location-info");

	if (!locationInfo.classList.contains("hidden"))
		locationInfo.classList.add("hidden");

	if (sightings.length > 0)
	{
		const noPassesMessage = document.querySelector("#no-passes-message");
		if (!noPassesMessage.classList.contains("hidden"))
			noPassesMessage.classList.add("hidden");

		// clear the list first
		while (sightingsListDiv.firstChild)
		{
			sightingsListDiv.removeChild(sightingsListDiv.firstChild);
		}

		if (sightingsDiv.classList.contains("hidden"))
			sightingsDiv.classList.remove("hidden");

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

			const timeString = new Date(pass.visible.startDate).toLocaleTimeString(undefined, liTimeFormat);
			const durationString = durationToString(pass.visible.durationSeconds);
			const maxElevationString = pass.visible.maxElevation;
			const liElement = createSightingListItem(timeString, durationString, maxElevationString, index);

			if (index == 0)
				firstLiElement = liElement;

			// separate sightings by day
			if (isDifferentDay)
			{
				var heading = document.createElement("h4");
				heading.innerHTML = new Date(pass.visible.startDate).toLocaleDateString(undefined, headingDateFormat);

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
	} else
	{
		if (!sightingsDiv.classList.contains("hidden"))
			sightingsDiv.classList.add("hidden");

		const noPassesMessage = document.querySelector("#no-passes-message");
		if (noPassesMessage.classList.contains("hidden"))
			noPassesMessage.classList.remove("hidden");
	}
}

function drawPassOnMap(pass)
{
	const sunlitPoints = pass.filter(point => point.visible === true);
	const sunlitCoords = sunlitPoints.map(point => [point.lat, point.lon]);

	const darkPoints = pass;
	const darkCoords = darkPoints.map(point => [point.lat, point.lon]);

	if (polylineSunlit)
		polylineSunlit.remove();

	if (polylineDark)
		polylineDark.remove();

	polylineDark = L.polyline(darkCoords, {color: LINE_DARK_COLOR}).addTo(map);
	polylineSunlit = L.polyline(sunlitCoords, {color: LINE_SUNLIT_COLOR}).addTo(map);

	if (startMarker)
		startMarker.remove();

	if (endMarker)
		endMarker.remove();

	startMarker = new L.marker(sunlitCoords[0], {opacity: 0});
	startMarker.bindTooltip("start", {permanent: true, className: "text-label", offset: [0, 0], direction: "bottom"});
	startMarker.addTo(map);

	endMarker = new L.marker(sunlitCoords[sunlitCoords.length-1], {opacity: 0});
	endMarker.bindTooltip("end", {permanent: true, className: "text-label", offset: [0, 0], direction: "bottom"});
	endMarker.addTo(map);
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
		locationMarker = L.marker(startPos,
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