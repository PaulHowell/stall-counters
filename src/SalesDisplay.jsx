import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import fbinitAnd from "./fbinit";
import * as moment from "moment-timezone";
import styles from "./SalesDisplay.css"
import _ from "lodash";

moment.locale('ja-JP');
const tokyo = 'Asia/Tokyo';

class SalesDisplay extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			loading: true,
			error: [],
			stallId: props.stallId,
			ref: null,
			menu: null,
			today: null,
			salesYenTot: null,
			salesYenToday: null,
			salesCntTot: null,
			salesCntToday: null,
			autoUnsbsc: null,
		}
	}

	componentDidMount() {
		try {
			fbinitAnd(() => {
				firebase.auth().signInAnonymously().then(() => {
					let doc = firebase.firestore().collection("stalls").doc(this.state.stallId);
					//firestoreからデータを引っ張ってくる。
					return doc.get();
				}).then(response => {
					if(!response.exists) throw new Error("invalid id specified.");
					this.setState({ ref: response.ref });
					this.loadData(response);
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

	//onSnapshotのオンオフ切り替え
	//チェックボックスのonChangeイベントで呼び出される
	toggleAuto(){
		let checkbox = document.getElementById("chkBoxAuto");   //undefinedの場合もある
		if (checkbox && checkbox.checked){  //自動更新オンモード
			let unsubscribe = this.state.ref.onSnapshot(
				snapshot=>this.loadData(snapshot),
				err => this.loadingError(err));
			this.setState({ autoUnsbsc: unsubscribe });
		}else{
			let unsubscribe = this.state.autoUnsbsc;
			if (unsubscribe) { //自動更新ストップ
				unsubscribe();
				this.setState({ autoUnsbsc: null });
			}
		}
	}

	//引っ張ってきた(Query)?DocumentSnapshotから必要なデータを読み取る
	loadData(docSS) {
		let menu = docSS.get("menu");
		let sales = docSS.get("sales");
		new Promise((resolve, reject) => {
			if (!moment(sales.today.toDate()).tz(tokyo).isSame(moment(), 'day')){
				//today関連の更新
				let cntToday = {};
				Object.keys(sales.cntToday).forEach(key => {
					cntToday[key] = 0;
				});
				docSS.ref.update({
					"sales.today": firebase.firestore.FieldValue.serverTimestamp(),
					"sales.yenToday": 0,
					"sales.cntToday": cntToday,
				}).then(() => docSS.ref.get())
					.then(res => resolve(res.get("sales")))
					.catch(error => reject(error));
			}else {
				resolve(sales);
			}
		}).then(sales => {
			this.setState({
				today: moment(sales.today.toDate()),
				menu: menu,
				salesYenTot: sales.yenTot,
				salesYenToday: sales.yenToday,
				salesCntTot: sales.cntTot,
				salesCntToday: sales.cntToday,
				loading: false,
			});
		}).catch(error => this.loadingError(error))
	}

	getMenuItem(itemId){
		if (this.state.menu[itemId]) return this.state.menu[itemId];
		for (let item of Object.values(this.state.menu)){
			if (item.sub && item.sub[itemId]) return item.sub[itemId];
		}
	}

	render() {
		if (this.state.error.length) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			return (<fieldset>
				<legend>売上</legend>
				<label><input id="chkBoxAuto" type="checkbox" onChange={this.toggleAuto.bind(this)}/>自動更新</label>
				<section>
					<h3>今日({this.state.today.format('l')}): &yen;{this.state.salesYenToday} </h3>
					<details open>
						<summary>詳細</summary>
						{Object.entries(this.state.menu).map( ([id, item]) => {
							if (!item.sub) {
								return <p key={id+"_today"}>{item.name}: {this.state.salesCntToday[id] || 0}個</p>
							}else {
								return <fieldset key={id+"_today"}>
									<legend>{item.name} {_.sum(Object.keys(item.sub).map(sub_id => (this.state.salesCntToday[sub_id] || 0)))}個</legend>
									{Object.entries(item.sub).map( ([sub_id, sub_item]) =>
										<div key={sub_id+"_today"}>{sub_item.name}: {this.state.salesCntToday[sub_id] || 0}個</div>
									)}
								</fieldset>
							}
						})}
					</details>
				</section>
				<section>
					<h3>総売上: &yen;{this.state.salesYenTot}</h3>
					<details open>
						<summary>詳細</summary>
						{Object.entries(this.state.menu).map( ([id, item]) => {
							if (!item.sub) {
								return <p key={id+"_tot"}>{item.name}: {this.state.salesCntTot[id] || 0}個</p>
							}else {
								return <fieldset key={id+"_tot"}>
									<legend>{item.name} {_.sum(Object.keys(item.sub).map(sub_id => (this.state.salesCntTot[sub_id] || 0)))}個</legend>
									{Object.entries(item.sub).map( ([sub_id, sub_item]) =>
										<div key={sub_id+"_tot"}>{sub_item.name}: {this.state.salesCntTot[sub_id] || 0}個</div>
									)}
								</fieldset>
							}
						})}
					</details>
				</section>
			</fieldset>)
		}
	}

	loadingError(error) {
		console.error(error);
		this.setState({ loading: false, error: this.state.error.concat(error) });
	}

}

render(<SalesDisplay stallId={location.pathname.split('/')[2]} />,   //htmlのディレクトリからidを取得
	document.getElementById("sales_disp"));