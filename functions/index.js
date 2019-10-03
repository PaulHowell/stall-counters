const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

const express = require('express');
const basicAuth = require('./auth');
const app = express();

app.all('/stall_menu.html', basicAuth);
app.use(express.static(__dirname + '/static/'));
exports.app = functions.https.onRequest(app);