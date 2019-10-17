// require('@babel/register'); // ES6を使えるようにする
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const src  = path.resolve(__dirname, 'src');
const build = path.resolve(__dirname, 'functions/static');
const pub = path.resolve(__dirname, 'public');

let config = {
	entry: {
		stall_list: src + '/StallList.jsx',
		stall_disp: src + '/SalesDisplay.jsx'
	},

	output: {
		//出力先のフォルダ
		path: build,
		//出力先のファイル名
		filename: '[name].js'
	},

	module: {
		rules: [
			{
				test: /\.jsx$/,
				exclude: /node_modules/,
				loader: 'babel-loader'
			},
			{
				test: /\.html$/,
				loader: 'html-loader'
			},
			{
				test: /\.css$/,
				loaders: ['style-loader', 'css-loader?modules'],
			},
		]
	},

	resolve: {
		extensions: ['.js', '.jsx']
	},

	plugins: [
		new CleanWebpackPlugin(),
		new HtmlWebpackPlugin({
			template: pub + '/index.html',
			filename: 'index.html',
			chunks: false
		}),
		new HtmlWebpackPlugin({
			template: pub + '/stall_list.html',
			filename: 'stall_list.html',
			chunks: ['stall_list']
		}),
		new HtmlWebpackPlugin({
			template: pub + '/uts1-12_mayFes2019/index.html',
			filename: 'uts1-12_mayFes2019/index.html',
			chunks: ['stall_disp']
		}),
		new HtmlWebpackPlugin({
			template: pub + '/404.html',
			filename: '404.html',
			inject: false
		}),
		new CopyPlugin([
			{ from: pub + '/img', to: 'img' },
		]),
	]
};

module.exports = (env, argv={mode:"development"}) => {
	if (argv.mode==="production"){
		config.mode = 'production';
		config.optimization = {
			minimize: true,
				minimizer: [new TerserPlugin({
				terserOptions: {
					compress: true,
					output: {
						comments: false,
						beautify: false
					}
				}
			})],
		}
	}else if (argv.mode==="development"){
		config.mode = 'development';
		config.devtool = 'source-map';
	}
	return config;
};
