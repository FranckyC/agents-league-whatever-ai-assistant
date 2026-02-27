const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    devtool: "source-map",
    optimization: {
        minimize: false
    },
    entry: path.resolve(__dirname, "./src/index.ts"),
    target: "node",
    externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: [                           
                {
                    loader: "ts-loader"
                }          
                ],
                exclude: [
                    /node_modules/
                ]
            }
        ]
    },
    resolve: {
        extensions: [".ts",".js"],
        alias: {
            'cldr$': 'cldrjs',
            'cldr': 'cldrjs/dist/cldr',
        }
    },
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, "./dist"),
        clean: true
    },
    plugins: [
        new CopyWebpackPlugin(
            {
              patterns: [
                { from: path.resolve(__dirname, "./web.config") },        
                { from: path.resolve(__dirname, "./package.json") },
              ]
            }
        ),
    ],
    ignoreWarnings: [
        {
            message: /Critical dependency: the request of a dependency is an expression/
        },
        {
            module: /node_modules\/require-in-the-middle/,
        },
        {
            message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/
        }
    ]
};
