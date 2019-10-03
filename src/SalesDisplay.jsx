import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import fbinitAnd from "./fbinit";
import styles from "./SalesDisplay.css"

Date.prototype.eqDateOnly = function(other){
	//TODO 型チェックとタイムゾーンチェック(必要かなあ)
	return this.getFullYear()===other.getFullYear() &&
		this.getMonth()===other.getMonth() &&
		this.getDate()===other.getDate()
};

class SalesDisplay extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			loading: true,
			error: null,
			id: null,
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
		//urlのパラメータでstallのidが渡される
		let urlParamStr = window.location.search;
		if (!urlParamStr) {
			this.setState({ loading: false, error:"parameters not found." })
		}else {
			urlParamStr = urlParamStr.substring(1);
			let params = {};
			urlParamStr.split('&').forEach(p => {
				let a = p.split('=');
				params[a[0]] = a[1];
			});
			document.title = `メニュー|${params.name}`;
			this.setState({id: params.id});
			try {
				fbinitAnd(() => {
					//firestoreからデータを引っ張ってくる。
					let doc = firebase.firestore().collection("stalls").doc(params.id);
					doc.get().then(response => {
						if(!response.exists) throw "Invalid id specified.";
						this.loadData(response);
						this.setState({ ref: doc, loading: false })
					});
				});
			} catch(error) {
				console.log(error);
				this.setState({loading: false, error: error});
			}
		}
	}

	//onSnapshotのオンオフ切り替え
	//チェックボックスのonChangeイベントで呼び出される
	toggleAuto(){
		let checkbox = document.getElementById("chkBoxAuto");
		if (checkbox && checkbox.checked){
			let unsubscribe = this.state.ref.onSnapshot(
				snapshot=>this.loadData(snapshot),
				error => {
					console.log(error);
					this.setState({ error: error })
				});
			this.setState({ autoUnsbsc: unsubscribe });
		}else{
			let unsubscribe = this.state.autoUnsbsc;
			if (unsubscribe && !this.state.error) unsubscribe()
		}
	}

	//引っ張ってきた(Query)?DocumentSnapshotから必要なデータを読み取る
	loadData(docSS) {
		let menu = docSS.get("menu");
		let sales = docSS.get("sales");
		if (!sales.today.toDate().eqDateOnly(new Date())){
			//TODO today関連の更新(GASでやるのもアリ)
		}
		this.setState({
			today: sales.today.toDate(),
			menu: menu,
			salesYenTot: sales.yenTot,
			salesYenToday: sales.yenToday,
			salesCntTot: sales.cntTot,
			salesCntToday: sales.cntToday,
		});
	}

	render() {
		if (this.state.error) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			//TODO 表示
			return (<fieldset>
				<legend>売上</legend>
				<label><input id="chkBoxAuto" type="checkbox" onChange={this.toggleAuto()}/>自動更新</label>
				<section>
					<h3>今日({this.state.today.toLocaleDateString('ja-JP')}): &yen;{this.state.salesYenToday} </h3>
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
}

render(<SalesDisplay />, document.getElementById("sales_disp"));