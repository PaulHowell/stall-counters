import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import fbinitAnd from "./fbinit";
import * as moment from "moment-timezone";
import styles from "./SalesDisplay.css"

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
					//firestoreからデータを引っ張ってくる。
					let doc = firebase.firestore().collection("stalls").doc(this.state.stallId);
					return doc.get();
				}).then(response => {
					if(!response.exists) throw new Error("invalid id specified.");
					this.loadData(response);
					this.setState({ ref: response.ref, loading: false });
				}).catch(err => this.loadingError(err));
			});
		} catch(err) {
			this.loadingError(err);
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
			if (unsubscribe && !this.state.error.length) unsubscribe() //自動更新ストップ
		}
	}

	//引っ張ってきた(Query)?DocumentSnapshotから必要なデータを読み取る
	loadData(docSS) {
		let menu = docSS.get("menu");
		let sales = docSS.get("sales");
		if (!moment(sales.today.toDate()).tz(tokyo).isSame(moment(), 'day')){
			//today関連の更新
			let yenToday = {};
			let cntToday = {};
			Object.keys(sales.yenToday).forEach(key => {
				yenToday[key] = 0;
				cntToday[key] = 0;
			});
			docSS.ref.update({  //FIXME これが何故かpermission deniedになる
				today: firebase.firestore.FieldValue.serverTimestamp(),
				yenToday: yenToday,
				cntToday: cntToday,
			}).then(() => this.loadData())  //非同期で更新したあとまた呼び出す
				.catch(error => this.loadingError(error));
		}
		this.setState({
			today: moment(sales.today.toDate()),
			menu: menu,
			salesYenTot: sales.yenTot,
			salesYenToday: sales.yenToday,
			salesCntTot: sales.cntTot,
			salesCntToday: sales.cntToday,
		});
	}

	render() {
		if (this.state.error.length) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			//TODO 表示
			return (<fieldset>
				<legend>売上</legend>
				<label><input id="chkBoxAuto" type="checkbox" onChange={this.toggleAuto()}/>自動更新</label>
				<section>
					<h3>今日({this.state.today.format('l')}): &yen;{this.state.salesYenToday} </h3>
					<details>
						<summary>詳細</summary>
						{Object.keys(this.state.salesCntToday).map(key =>
							<p key={key+"_today"}>{this.state.menu[key].name}: {this.state.salesCntToday[key]}個</p>
						)}
					</details>
				</section>
				<section>
					<h3>総売上: &yen;{this.state.salesYenTot}</h3>
					<details>
						<summary>詳細</summary>
						{Object.keys(this.state.salesCntTot).map(key =>
							<p key={key+"_tot"}>{this.state.menu[key].name}: {this.state.salesCntTot[key]}個</p>
						)}
					</details>
				</section>
			</fieldset>)
		}
	}

	loadingError(error) {
		console.log(error);
		this.setState({ loading: false, error: this.state.error.concat(error) });
	}

}

render(<SalesDisplay stallId={location.pathname.split('/')[2]}/>,   //htmlのディレクトリからidを取得
	document.getElementById("sales_disp"));