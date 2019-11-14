import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import fbinitAnd from "./fbinit";

class OrdersDisplay extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			loading: true,
			error: [],
			stallId: props.stallId,
			ref: null,
			salesTableRef: null,
			menu: null,
			queue: [],
			autoUnsbsc: null,
		}
	}

	componentDidMount() {
		try {
			fbinitAnd(() => {
				firebase.auth().signInAnonymously().then(() => {
					let doc = firebase.firestore().collection("stalls").doc(this.state.stallId);
					let table = doc.collection("sales_table");
					this.setState({ stallRef: doc, salesTableRef: table });
					//firestoreからデータを引っ張ってくる。
					return doc.get();
				}).then(response => {
					if(!response.exists) throw new Error("invalid id specified.");
					this.loadData(response);
					this.setState({loading: false });
				}).catch(err => this.loadingError(err));
			});
		} catch(err) {
			this.loadingError(err);
		}
	}

	loadData(docSS) {
		let menu = docSS.get("menu");
		this.setState({ menu: menu });
	}


}