import "../css/main.css";
import "../../node_modules/leaflet/dist/leaflet.css";
import "../../node_modules/leaflet/dist/images/marker-shadow.png";
import "../../node_modules/leaflet/dist/images/marker-icon-2x.png";
import "leaflet";
import "../images/logo.png";
import { ToggleButtonComponent } from "./components/toggle-button/toggle-button";
import { ThemeSettingsComponent } from "./components/theme-settings/theme-settings";

const startPos = [51.505, -0.09]; // default map position
const headingDateFormat = {day: "2-digit", month: "long", year: "numeric"};
const liTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short"};
const detailsDateFormat = {day: "2-digit", month: "short", year: "numeric"};
const detailsTimeFormat = {hour: "2-digit", minute: "2-digit", second: "2-digit"};
const headers = {headers: {"User-Agent": "issviewer"}};
const lineColor =
{
	default:
	{
		sunlit: "rgb(255, 42, 42)",
		shadowed: "rgba(9, 0, 129, 0.3)"
	},
	darkTheme:
	{
		sunlit: "rgb(255, 79, 79)",
		shadowed: "rgba(121, 121, 240, 0.5)"
	}
};

let map;
let passes = {};
let locationMarker;
let startMarker; // marks visible pass start
let endMarker; // marks visible pass end
let polylineSunlit; // visible path
let polylineShadowed; // path in Earth's shadow
let isDarkTheme = false;

// updates current position of ISS on the map on tracking page
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

// updates orbital information on tracking page
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

// user changed location
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

function createSightingListItem(time, duration, brightness, passId)
{
	let li = document.createElement("li");
	li.dataset.passId = passId;
	let itemHtml =`\
<span class="date">${time}</span>\
<span class="duration">${duration}</span>\
`;

	let numBars = 1;
	if (brightness <= -3.5)
		numBars = 4;
	else if (brightness <= -2.5)
		numBars = 3;
	else if (brightness <= -1.5)
		numBars = 2;

	let brightnessIndicator = document.createElement("div");
	brightnessIndicator.classList.add("brightness-indicator");
	let brightnessIndicatorHtml = `\
<div class="bar bar-1 ${numBars > 0 ? 'full' : ''}"></div>\
<div class="bar bar-2 ${numBars > 1 ? 'full' : ''}"></div>\
<div class="bar bar-3 ${numBars > 2 ? 'full' : ''}"></div>\
<div class="bar bar-4 ${numBars > 3 ? 'full' : ''}"></div>\
	<span class="brightness-value">${brightness.toFixed(1)} mag</span>`;
	brightnessIndicator.insertAdjacentHTML("beforeend", brightnessIndicatorHtml);

	li.insertAdjacentHTML("beforeend", itemHtml);
	li.appendChild(brightnessIndicator);
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

	document.getElementById("detail-alt-start").innerHTML = selectedPass.visible.startElevation + "&deg;";
	document.getElementById("detail-alt-max").innerHTML = selectedPass.visible.maxElevation + "&deg;";
	document.getElementById("detail-alt-end").innerHTML = selectedPass.visible.endElevation + "&deg;";

	document.getElementById("detail-dir-start").innerHTML = azimuthToDirectionString(selectedPass.visible.startAzimuth);
	document.getElementById("detail-dir-max").innerHTML = azimuthToDirectionString(selectedPass.visible.maxAzimuth);
	document.getElementById("detail-dir-end").innerHTML = azimuthToDirectionString(selectedPass.visible.endAzimuth);

	document.getElementById("detail-mag-start").innerHTML = selectedPass.visible.startMagnitude.toFixed(1) + " mag";
	document.getElementById("detail-mag-max").innerHTML = selectedPass.visible.maxMagnitude.toFixed(1) + " mag";
	document.getElementById("detail-mag-end").innerHTML = selectedPass.visible.endMagnitude.toFixed(1) + " mag";
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

		let prevDay;
		let firstLiElement;
		sightings.forEach((pass, index) =>
		{
			let isDifferentDay = false;
			if (!prevDay || prevDay != new Date(pass.startDate).getDate())
			{
				prevDay = new Date(pass.startDate).getDate();
				isDifferentDay = true;
			}

			const timeString = new Date(pass.visible.startDate).toLocaleTimeString(undefined, liTimeFormat);
			const durationString = durationToString(pass.visible.durationSeconds);
			const liElement = createSightingListItem(timeString, durationString, pass.visible.brightestMagnitude, index);

			if (index == 0)
				firstLiElement = liElement;

			// separate sightings by day
			if (isDifferentDay)
			{
				let heading = document.createElement("h4");
				heading.innerHTML = new Date(pass.visible.startDate).toLocaleDateString(undefined, headingDateFormat);

				let ul = document.createElement("ul");
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

		// clear last trajectory from the map
		if (polylineSunlit)
			polylineSunlit.remove();

		if (polylineShadowed)
			polylineShadowed.remove();

		if (startMarker)
			startMarker.remove();

		if (endMarker)
			endMarker.remove();
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

	if (polylineShadowed)
		polylineShadowed.remove();

	// path colors depend on selected theme
	const sunlitColor = isDarkTheme ? lineColor.darkTheme.sunlit : lineColor.default.sunlit;
	const shadowedColor = isDarkTheme ? lineColor.darkTheme.shadowed : lineColor.default.shadowed;
	polylineShadowed = L.polyline(darkCoords, {color: shadowedColor}).addTo(map);
	polylineSunlit = L.polyline(sunlitCoords, {color: sunlitColor}).addTo(map);

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

// azimuth in degrees
function azimuthToDirectionString(azimuth)
{
	const directions = [
		"N", // north for 0 degrees
		"NNE",
		"NE",
		"ENE",
		"E",
		"ESE",
		"SE",
		"SSE",
		"S",
		"SSW",
		"SW",
		"WSW",
		"W",
		"WNW",
		"NW",
		"NNW",
		"N" // north again for 360 degress
	];

	let index = Math.round(azimuth / 22.5);
	return directions[index];
}

function initializeMap()
{
	const mapElementId = "map";
	map = L.map(mapElementId,
	{
		attributionControl: false
	});

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	{
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		className: "map-tiles"
	}).addTo(map);

	L.control.attribution({prefix: ""}).addTo(map);
}

// theme changed in user's OS
function themeChanged(e)
{
	const themeToggle = document.querySelector("nav theme-settings").toggleElement;
	isDarkTheme = e.matches == true;
	themeToggle.setPressed(isDarkTheme);
}

window.addEventListener("load", () =>
{
	// define components
	customElements.define("toggle-button", ToggleButtonComponent);
	customElements.define("theme-settings", ThemeSettingsComponent);

	// detect system theme changes
	const darkThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
	isDarkTheme = darkThemeQuery.matches;
	darkThemeQuery.addEventListener("change", themeChanged);

	if (isDarkTheme)
		document.querySelector("nav theme-settings").toggleElement.setPressed(true);

	const bodyId = document.body.getAttribute("id");
	if (bodyId == "home")
	{
		initializeMap();
		const locationInput = document.querySelector("#location");
		locationInput.value = ""; // clear input on refresh
		locationInput.addEventListener("change", locationInputChange);

		map.setView(startPos, 4);

	} else if (bodyId == "tracking")
	{
		initializeMap();
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