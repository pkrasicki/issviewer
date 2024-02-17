const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports =
{
	mode: "development",
	entry: "./public/js/main.js",
	output:
	{
		path: path.resolve(__dirname, "dist"),
		filename: "main.js",
	},
	devtool: process.env.NODE_ENV == "production" ? "source-map" : "inline-source-map",
	optimization:
	{
		minimizer:
		[
			new TerserPlugin(),
			new CssMinimizerPlugin()
		]
	},
	module:
	{
		rules:
		[
			{
				test: /\.css$/,
				use:
				[
					{
						loader: MiniCssExtractPlugin.loader
					},
					"css-loader"
				]
			},
			{
				test: /\.png$/i,
				type: "asset/resource",
				generator:
				{
					filename: "images/[name][ext]"
				}
			},
			{
				test: /\.html$/,
				loader: "html-loader"
			}
		]
	},
	plugins:
	[
		new webpack.ProvidePlugin
		({
			satellite: "satellite.js"
		}),
		new MiniCssExtractPlugin({}),
		new HtmlWebpackPlugin(
		{
			filename: "index.html",
			template: "./public/index.html",
			favicon: "./public/favicon.ico"
		}),
		new HtmlWebpackPlugin(
		{
			filename: "tracking.html",
			template: "./public/tracking.html",
			favicon: "./public/favicon.ico"
		}),
		new HtmlWebpackPlugin(
		{
			filename: "about.html",
			template: "./public/about.html",
			favicon: "./public/favicon.ico"
		})
	]
};