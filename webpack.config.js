const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCssAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports =
{
	mode: "development",
	entry: "./public/js/main.js",
	output:
	{
		path: path.resolve(__dirname, "dist"),
		filename: "main.js"
	},
	devServer:
	{
		contentBase: "./dist"
	},
	devtool: "inline-source-map",
	optimization:
	{
		minimizer:
		[
			new TerserPlugin({}),
			new OptimizeCssAssetsPlugin({})
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
				test: /\.(png)$/,
				use:
				{
					loader: "file-loader",
					options:
					{
						outputPath: "images",
						name: "[name].[ext]"
					}
				}
			}
		]
	},
	plugins:
	[
		new webpack.ProvidePlugin
		({
			satellite: "satellite.js"
		}),
		new MiniCssExtractPlugin(
		{
			name: "[name].[ext]"
		}),
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