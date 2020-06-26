const { spawn } = require("child_process");

module.exports =
{
	// execute the python script to get a list of passes
	getPasses: async (tleData, lon, lat) =>
	{
		const numDays = 10;
		const scriptName = "predict.py";
		const pyPredict = spawn("python3", ["predict.py", JSON.stringify(tleData), lon, lat, numDays]);

		return new Promise((resolve, reject) =>
		{
			let dataString = "";

			pyPredict.stdout.on("data", data =>
			{
				dataString += data.toString("utf8");
			});

			pyPredict.stderr.on("data", data =>
			{
				console.log(`ERROR in ${scriptName}: `, data.toString("utf8"));
				reject();
			});

			pyPredict.on("error", err =>
			{
				console.log(`ERROR in ${scriptName}: `, err.toString("utf8"));
				reject();
			});

			pyPredict.on("close", code =>
			{
				resolve(JSON.parse(dataString));
			});
		});
	}
}