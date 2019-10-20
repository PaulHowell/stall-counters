const auth = require('basic-auth');

const admins = {
	'master': { password: 'daphnia' },
};
const iceage = {
	'uts1-12': { password: 'meichan' }
};

module.exports = function (req, res, next) {
	let user = auth(req);

	if (user) {
		stall = req.params.stallId;
		if (admins[user.name] && admins[user.name].password === user.pass) {
			return next();
		}else if(stall) {
			if (stall==='uts1-12_mayFes2019' && iceage[user.name] && iceage[user.name].password===user.pass){
				return next();
			}
		}
	}
	res.set('WWW-Authenticate', 'Basic realm="example"');
	return res.sendStatus(401);
};