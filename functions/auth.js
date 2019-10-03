const auth = require('basic-auth');

const admins = {
	'username': { password: 'password' },
};

module.exports = function (req, res, next) {
	let user = auth(req);

	if (user) {
		if (admins[user.name] && admins[user.name].password === user.pass) {
			return next();
		}
	}
	res.set('WWW-Authenticate', 'Basic realm="example"');
	return res.status(401).send();
};