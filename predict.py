from datetime import datetime
from datetime import timedelta
import math
import json
import sys
import calendar
import ephem

MIN_PASS_ELEVATION = 10 # (degrees) pass must be at least at this elevation to be visible
POINT_TIME_INTERVAL_SECONDS = 10 # how often points from a pass are checked (less time means more frequent)
PASS_TIME_DELAY = timedelta(minutes=10) # how much time to add when current pass is over

# convert ehpem time to datetime
def to_datetime(time):
	year, month, day, hour, minute, second = time.tuple()
	return datetime(year, month, day, hour, minute, int(second))

# datetime to JS timestamp
def to_timestamp(date_time):
	return calendar.timegm(date_time.utctimetuple()) * 1000 # multiply to get JavaScript timestamp

#-------------------------------------------------------------------------
#
# The MIT License (MIT)
#
# Copyright (c) 2020 Liam Kennedy : 8/20/2020
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
#
# The above copyright notice and this permission notice shall be included
# in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
# CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
# TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
#
#-------------------------------------------------------------------------
def magnitude(sat_range, sat_azimuth, sat_altitude, sun_distance, sun_azimuth, sun_altitude):
	AU = 149597871 # Astronimical Unit (km)
	STANDARD_MAG = -1.3 # intrinsic brightness of ISS at 1000km
						# Cannot remember source for this - some suggest it should be lower now (making ISS brighter)
						# I still find this lines up with how I think it is visually

	a = sun_distance * AU - ephem.earth_radius # distance sun from observer (Km)
	b = sat_range / 1000 # distance to ISS from observer (Km)
	angle_c = ephem.separation((sat_azimuth, sat_altitude), (sun_azimuth, sun_altitude))
	c = math.sqrt(math.pow(a,2) + math.pow(b,2) - 2 * a * b * math.cos(angle_c))

	phase_angle = math.acos((math.pow(b, 2) + math.pow(c, 2) - math.pow(a, 2)) / (2 * b * c))

	# This is the MAGIC equation (Author: Matson, Robert)
	mag = STANDARD_MAG - 15 + 5 * math.log10(sat_range / 1000) - 2.5 * math.log10(math.sin(phase_angle) + ((math.pi - phase_angle) * math.cos(phase_angle)))
	return mag

# predicts visible satellite passes
# lon and lat are in degrees as strings
def predict_passes(tle_array, lon, lat, num_days):
	start_date = datetime.utcnow()
	end_date = start_date + timedelta(days=num_days)
	passes = []

	observer = ephem.Observer()
	observer.lon = lon
	observer.lat = lat
	observer.elevation = 50
	observer.date = start_date

	satellite = ephem.readtle(tle_array[0], tle_array[1], tle_array[2])

	while(True):
		arr = observer.next_pass(satellite)
		pass_obj = {
			"startDate": to_datetime(arr[0]),
			# "startAzimuth": arr[1],
			"maxDate": to_datetime(arr[2]),
			"maxElevation": arr[3],
			"endDate": to_datetime(arr[4]),
			# "endAzimuth": arr[5],
			# "durationSeconds": round(arr[4] - arr[0]),
			"points": [],
			"visible": {
				"startDate": None,
				"startElevation": 0,
				"startAzimuth": 0,
				"maxDate": None,
				"maxElevation": 0,
				"maxAzimuth": 0,
				"endDate": None,
				"endElevation": 0,
				"endAzimuth": 0,
				"durationSeconds": 0,
				"startMagnitude": 0,
				"maxMagnitude": 0,
				"endMagnitude": 0
			}
		}

		# end searching on end_date
		if (pass_obj["startDate"] > end_date):
			break

		# skip passes that aren't at least MIN_PASS_ELEVATION degrees above horizon
		if (math.degrees(pass_obj["maxElevation"]) < MIN_PASS_ELEVATION):
			observer.date = pass_obj["endDate"] + PASS_TIME_DELAY
			continue

		cur_time = pass_obj["startDate"]
		observer.date = cur_time
		sun = ephem.Sun()
		sun.compute(observer)

		# make sure sky is dark enough - sun needs to be below horizon
		if (math.degrees(sun.alt) > -6):
			observer.date = pass_obj["endDate"] + PASS_TIME_DELAY
			continue

		# get coordinates of individual points
		while (cur_time < pass_obj["endDate"]):
			satellite.compute(observer)
			point = {
				"date": to_timestamp(cur_time),
				"lat": math.degrees(satellite.sublat),
				"lon": math.degrees(satellite.sublong),
				"azimuth": math.degrees(satellite.az),
				"elevation": round(math.degrees(satellite.alt)),
				"visible": not satellite.eclipsed and round(math.degrees(satellite.alt)) >= MIN_PASS_ELEVATION,
				"magnitude": 0
			}

			# update information about the visible part of the pass
			if (point["visible"]):
				sun.compute(observer)
				point["magnitude"] = magnitude(satellite.range, satellite.az, satellite.alt, sun.earth_distance, sun.az, sun.alt)

				if (pass_obj["visible"]["startDate"] is None):
					pass_obj["visible"]["startDate"] = to_timestamp(cur_time)
					pass_obj["visible"]["startElevation"] = point["elevation"]
					pass_obj["visible"]["startAzimuth"] = point["azimuth"]
					pass_obj["visible"]["maxElevation"] = point["elevation"]
					pass_obj["visible"]["maxAzimuth"] = point["azimuth"]
					pass_obj["visible"]["maxDate"] = to_timestamp(cur_time)
					pass_obj["visible"]["startMagnitude"] = point["magnitude"]

				if (point["elevation"] > pass_obj["visible"]["maxElevation"]):
					pass_obj["visible"]["maxElevation"] = point["elevation"]
					pass_obj["visible"]["maxAzimuth"] = point["azimuth"]
					pass_obj["visible"]["maxDate"] = to_timestamp(cur_time)
					pass_obj["visible"]["maxMagnitude"] = point["magnitude"]

				pass_obj["visible"]["endDate"] = point["date"]
				pass_obj["visible"]["endElevation"] = point["elevation"]
				pass_obj["visible"]["endAzimuth"] = point["azimuth"]
				pass_obj["visible"]["endMagnitude"] = point["magnitude"]
				duration_seconds = (pass_obj["visible"]["endDate"] - pass_obj["visible"]["startDate"]) / 1000
				pass_obj["visible"]["durationSeconds"] = duration_seconds

			pass_obj["points"].append(point)
			cur_time += timedelta(seconds=POINT_TIME_INTERVAL_SECONDS)
			observer.date = cur_time

		observer.date = pass_obj["endDate"] + PASS_TIME_DELAY

		# skip the pass if its visible part is very short or none
		if (pass_obj["visible"]["durationSeconds"] > POINT_TIME_INTERVAL_SECONDS):
			pass_obj["startDate"] = to_timestamp(pass_obj["startDate"])
			pass_obj["maxDate"] = to_timestamp(pass_obj["maxDate"])
			pass_obj["endDate"] = to_timestamp(pass_obj["endDate"])
			passes.append(pass_obj)

	return passes

if (len(sys.argv) >= 5):
	tle_array = json.loads(sys.argv[1])
	num_days = int(sys.argv[4])
	json_string = json.dumps(predict_passes(tle_array, sys.argv[2], sys.argv[3], num_days))
	print(json_string)
else:
	sys.stderr.write("error: missing arguments")