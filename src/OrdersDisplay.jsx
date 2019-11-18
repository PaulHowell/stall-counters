import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import fbinitAnd from "./fbinit";
import styles from "./OrdersDisplay.css"

class OrderCard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			index: props.index,
			ref: props.doc_ref,
			order: props.order,
			menu: props.menu,
			timestamp: props.timestamp,
		}
	}

	getMenuName(itemId){
		if (this.state.menu[itemId]) return this.state.menu[itemId].name;
		for (let item of Object.values(this.state.menu)){
			if (item.sub){
				if (item.sub[itemId]) return item.sub[itemId].name;
			}
		}
	}

	render() {
		return <span className={styles.order_card}>
			<div>注文番号: {this.state.index}</div>
			<ul>
				{Object.entries(this.state.order).map(([item_id, cnt]) =>
					<li key={item_id}>{this.getMenuName(item_id)} {cnt}個</li>
				)}
			</ul>
			<div>
			</div>
		</span>
	}
}

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
			queue: {},
			autoUnsbsc: null,
		}
	}

	componentDidMount() {
		try {
			fbinitAnd(() => {
				firebase.auth().signInAnonymously().then(() => {
					let doc = firebase.firestore().collection("stalls").doc(this.state.stallId);
					let table = doc.collection("sales_table");
					let query = table.where("served", "==", false).orderBy("index", "asc");
					this.setState({ stallRef: doc, salesTableRef: table, autoUnsbsc: query.onSnapshot(ss => {this.onSnapshot(ss);}) });
					//firestoreからデータを引っ張ってくる。
					return Promise.all([doc.get(), query.get()]);
				}).then(([d_res, q_res]) => {
					if(!d_res.exists) throw new Error("invalid id specified.");
					this.loadData(d_res, q_res);
				}).catch(err => this.loadingError(err));
			});
		} catch(err) {
			this.loadingError(err);
		}
	}

	onSnapshot(snapshot) {
		this.updateQueue(snapshot);
	}

	loadData(stall_docSS, qSS) {
		let menu = stall_docSS.get("menu");
		let queue = {};
		qSS.docs.forEach(data => {    // DocumentSnapShotの配列
			queue[data.get("index")] = this.extractOrderData(data);
		});
		this.setState({ menu: menu, queue: queue, loading: false });
	}

	loadingError(error) {
		console.error(error);
		this.setState({ loading: false, error: this.state.error.concat(error) });
	}

	updateQueue(qSS) {
		let queue = this.state.queue;
		qSS.docChanges().forEach(change => {    // DocumentChangeの配列
			let doc = change.doc;
			switch (change.type) {
				case "added":
					queue[doc.get("index")] = this.extractOrderData(doc);
					break;
				case "modified":
					if (!doc.get("served")){
						queue[doc.get("index")] =this.extractOrderData(doc);
					}else {
						delete queue[doc.get("index")];
					}
					break;
				case "removed":
					delete queue[doc.get("index")];
					break;
			}
		});
		this.setState({ queue: queue });
	}

	extractOrderData(doc){
		return {
			id: doc.id,
			order: doc.get("order"),
			timestamp: doc.get("timestamp"),
		};
	}

	render() {
		if (this.state.error.length) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			return [
				<h2>注文一覧</h2>,
				<section>
					{Object.entries(this.state.queue).map(([index, data]) =>
					<OrderCard key={data.id}
					           index={index}
					           doc_ref={this.state.salesTableRef.doc(data.id)}
					           order={data.order}
					           menu={this.state.menu}
					           timestamp={data.timestamp}
					/>
					)}
				</section>,
			]
		}
	}

}

render(<OrdersDisplay stallId={location.pathname.split('/')[2]} />,
	document.getElementById("order_disp"));