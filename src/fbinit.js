import * as firebase from "firebase/app";

function fbinitAnd(func){
	if (!firebase.apps.length) {
		fetch('/__/firebase/init.json').then(async response => {
			firebase.initializeApp(await response.json());
			func();
		}).catch( (error) => {
			throw error;
		});
	} else {
		func();
	}
}
export default fbinitAnd;