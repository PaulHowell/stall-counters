import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faReceipt} from "@fortawesome/free-solid-svg-icons";
import fbinitAnd from "./fbinit";
import styles from "./OrdersDisplay.css"
import * as moment from "moment-timezone";

moment.locale('ja-JP');
const tokyo = 'Asia/Tokyo';

class OrderCard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			index: props.index,
			stall_ref: props.stall_ref,
			doc_ref: props.doc_ref,
			order: props.order,
			menu: props.menu,
			total_price: props.total_price,
			timestamp: props.timestamp,
			btn_disabled: false,
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

	onCancel(){
		if (window.confirm("[確認] 本当にキャンセルしますか？")) {
			this.setState({btn_disabled: true});
			firebase.firestore().runTransaction(async transaction => {
				const stallData = await transaction.get(this.state.stall_ref);
				const sales = stallData.get("sales");
				let cntToday = sales.cntToday;
				let cntTot = sales.cntTot;
				for (let [item, cnt] of Object.entries(this.state.order)) {
					cntToday[item] -= cnt;
					cntTot[item] -= cnt;
				}
				if (moment(sales.today.toDate()).tz(tokyo).isSame(moment(), 'day')){
					transaction.update(this.state.stall_ref, {
						"sales.yenToday": firebase.firestore.FieldValue.increment(-this.state.total_price),
						"sales.cntToday": cntToday,
					});
				}
				transaction.update(this.state.stall_ref, {
					"sales.yenTot": firebase.firestore.FieldValue.increment(-this.state.total_price),
					"sales.cntTot": cntTot,
				});
				transaction.delete(this.state.doc_ref);
			}).catch(error => {
				console.error(error);
				window.alert("エラー\n" + error);
			});
		}
	}

	onServe(){
		this.setState({ btn_disabled: true });
		this.state.doc_ref.update("served", true);
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
				<button className={styles.serve_btn} disabled={this.state.btn_disabled} onClick={this.onServe.bind(this)}>受渡し完了</button>
				<button className={styles.cancel_btn} disabled={this.state.btn_disabled} onClick={this.onCancel.bind(this)}>キャンセル</button>
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
			stallRef: null,
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

	componentWillUnmount(){
		let unsubscribe = this.state.autoUnsbsc;
		if (unsubscribe) { //自動更新ストップ
			unsubscribe();
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
			total_price: doc.get("total_price"),
			timestamp: doc.get("timestamp"),
		};
	}

	getSummary(){
		let summary = {};
		Object.values(this.state.queue).forEach( data => {
			Object.entries(data.order).forEach(([item_id, cnt]) => {
				if (cnt){
					summary[item_id] = (summary[item_id] || 0) + cnt;
				}
			});
		});
		return summary
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
		if (this.state.error.length) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			return [
				<fieldset>
					<legend>注文概要(トータル)</legend>
					{Object.entries(this.getSummary()).map(([id, cnt]) =>
						<p key={"summary_"+id}>{this.getMenuName(id)}: {cnt}個</p>
					)}
				</fieldset>,
				<h2><FontAwesomeIcon icon={faReceipt} />注文一覧</h2>,
				<section>
					{(Object.keys(this.state.queue).length) ?
						Object.entries(this.state.queue).map(([index, data]) =>
						<OrderCard key={data.id}
						           index={index}
						           stall_ref={this.state.stallRef}
						           doc_ref={this.state.salesTableRef.doc(data.id)}
						           order={data.order}
						           menu={this.state.menu}
						           timestamp={data.timestamp}
						           total_price={data.total_price}
						/>
					)   :   <p>現在、注文なし</p>
					}
				</section>,
			]
		}
	}

}

render(<OrdersDisplay stallId={location.pathname.split('/')[2]} />,
	document.getElementById("order_disp"));