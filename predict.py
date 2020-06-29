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
				"maxDate": None,
				"maxElevation": 0,
				"endDate": None,
				"endElevation": 0,
				"durationSeconds": 0
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
				# "azimuth": math.degrees(satellite.az),
				"elevation": round(math.degrees(satellite.alt)),
				"visible": not satellite.eclipsed and round(math.degrees(satellite.alt)) >= MIN_PASS_ELEVATION
			}

			# update information about the visible part of the pass
			if (point["visible"]):
				if (pass_obj["visible"]["startDate"] is None):
					pass_obj["visible"]["startDate"] = to_timestamp(cur_time)
					pass_obj["visible"]["startElevation"] = point["elevation"]
					pass_obj["visible"]["maxElevation"] = point["elevation"]
					pass_obj["visible"]["maxDate"] = to_timestamp(cur_time)

				if (point["elevation"] > pass_obj["visible"]["maxElevation"]):
					pass_obj["visible"]["maxElevation"] = point["elevation"]
					pass_obj["visible"]["maxDate"] = to_timestamp(cur_time)

				pass_obj["visible"]["endDate"] = point["date"]
				pass_obj["visible"]["endElevation"] = point["elevation"]
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