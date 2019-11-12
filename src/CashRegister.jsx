import React from 'react';
import {render} from 'react-dom';
import _ from "lodash";
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlusCircle, faMinusCircle} from "@fortawesome/free-solid-svg-icons";
import fbinitAnd from "./fbinit";
import styles from "./CashRegister.css";
import * as moment from "moment-timezone";

moment.locale('ja-JP');
const tokyo = 'Asia/Tokyo';

function MenuItem(props){
	return <span className={styles.mt_item}>
		<button onClick={props.onMinusClick}><FontAwesomeIcon icon={faMinusCircle} color="blue" /></button>
		<span>{props.name}</span>
		<button onClick={props.onPlusClick}><FontAwesomeIcon icon={faPlusCircle} color="red" /></button>
	</span>
}

class CashRegister extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			loading: true,
			error: [],
			stallId: props.stallId,
			stallRef: null,
			salesTableRef: null,
			menu: null,
			tickets: null,
			order: {},
			usedTickets: {},
		}
	}

	componentDidMount(){
		try {
			fbinitAnd(() => {
				firebase.auth().signInAnonymously().then(() => {
					let doc = firebase.firestore().collection("stalls").doc(this.state.stallId);
					let table = doc.collection("sales_table");
					this.setState({ stallRef: doc, salesTableRef: table });
					return doc.get();
				}).then(response => {
					if (!response.exists) throw new Error("invalid id specified.");
					this.loadData(response);
					this.setState({ loading: false });
				}).catch(err => this.loadingError(err));
			});
		} catch(err) {
			this.loadingError(err);
		}
	}

	// 引っ張ってきた(Query)?DocumentSnapshotから必要なデータを読み取る
	loadData(docSS) {
		let menu = docSS.get("menu");
		let tickets = docSS.get("tickets");
		this.setState({ menu: menu, tickets: tickets });
	}

	loadingError(error) {
		console.error(error);
		this.setState({ loading: false, error: this.state.error.concat(error) });
	}

	// 合計金額計算
	calculate(){
		if (!this.chkTickets()) return "チケットが注文数より多い";
		let price = _.sum(Object.entries(this.state.order).map(([id, cnt]) => this.price(id)*cnt));
		let discount = _.sum(Object.entries(this.state.usedTickets).map(([ticketId, cnt]) => this.state.tickets[ticketId].discount * cnt));
		return price - discount
	}

	// メニューから、該当するidのアイテムを探して値段を返す
	price(itemId){
		if (this.state.menu[itemId]) return this.state.menu[itemId].price;
		for (let item of Object.values(this.state.menu)){
			if (item.sub){
				if (item.sub[itemId]) return item.sub[itemId].price;
			}
		}
	}

	chkTickets(){
		return Object.entries(this.state.usedTickets).every(([ticketId, cnt]) =>
			_.sum(this.state.tickets[ticketId].available4.map(id => this.getOrderOf(id))) >= cnt
		);
	}

	onOrderChanged(itemId, addedCnt){
		let ord = this.state.order;
		ord[itemId] = Math.max(this.getOrderOf(itemId) + addedCnt, 0);
		this.setState({ order: ord });
		//TODO その商品のみに対応するチケットがある場合、そのチケットも減らす(チケット枚数が超えないように)  (あとでおk)
	}

	onTicketsChanged(ticketId, addedCnt){
		let ticket = this.state.tickets[ticketId];
		let usedTickets = this.state.usedTickets;
		usedTickets[ticketId] = Math.max((usedTickets[ticketId] || 0) + addedCnt, 0);
		// もし1つの商品のみに対応している場合、それの注文数も合わせて増やす(チケット枚数が超えないように)
		if (ticket.available4.length===1){
			let id = ticket.available4[0];
			if (this.getOrderOf(id) < usedTickets[ticketId]) {
				this.onOrderChanged(id, usedTickets[ticketId] - this.getOrderOf(id));
			}
		}
		this.setState({ usedTickets: usedTickets });
	}

	getOrderOf(id){
		return this.state.order[id] || 0
	}

	clearAll(){
		this.setState({ order: {}, usedTickets: {} });
	}

	// 注文確定。注文個数を0に。
	submit(){
		if (!this.chkTickets()) return;
		let total_price = this.calculate();
		let order = this.state.order;
		let usedTickets = this.state.usedTickets;
		this.state.salesTableRef.add({
			timestamp: firebase.firestore.FieldValue.serverTimestamp(),
			staff: firebase.auth().currentUser.uid,
			order: order,
			tickets: usedTickets,
			total_price: total_price,
		}).catch(error => {console.error(error)});
		this.state.stallRef.get().then(response => {
			return new Promise((resolve, reject) => {
				let sales = response.get("sales");
				if (!moment(sales.today.toDate()).tz(tokyo).isSame(moment(), 'day')){
					//today関連の更新
					let cntToday = {};
					Object.keys(sales.cntToday).forEach(key => {
						cntToday[key] = 0;
					});
					this.state.stallRef.update({
						"sales.today": firebase.firestore.FieldValue.serverTimestamp(),
						"sales.yenToday": 0,
						"sales.cntToday": cntToday,
					}).then(() => {response.ref.get()})
						.then(latest_response => {resolve(latest_response)})
						.catch(error => {reject(error)});
				}else resolve(response);
			});
		}).then(response => {
			let sales = response.get("sales");
			let cntToday = sales.cntToday;
			let cntTot = sales.cntTot;
			for (let [item, cnt] of Object.entries(order)){
				cntToday[item] += cnt;
				cntTot[item] += cnt;
			}
			this.state.stallRef.update({
				"sales.yenToday": firebase.firestore.FieldValue.increment(total_price),
				"sales.cntToday": cntToday,
				"sales.yenTot": firebase.firestore.FieldValue.increment(total_price),
				"sales.cntTot": cntTot,
			})
		}).then(() => {
			this.clearAll();
		}).catch(error => console.error(error));
	}

	submitEnabled(){
		if (!Object.keys(this.state.order).length || Object.values(this.state.order).every(cnt => cnt===0)) return false;
		return this.chkTickets();
	}

	render(){
		if (this.state.error.length) {
			return <ErrLoading error={this.state.error} />;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			return [
				<h1>注文</h1>,
				<h3 className={styles.cash_disp}>合計: &yen;{this.calculate()}</h3>,
				// メニュー一覧
				Object.entries(this.state.menu).map( ([id, item]) => {
					if (item.price) {
						return <div key={id}>
							<MenuItem name={item.name}
						                 onMinusClick={this.onOrderChanged.bind(this, id, -1)}
						                 onPlusClick={this.onOrderChanged.bind(this, id, 1)} />
							{this.getOrderOf(id)}個 単価&yen;{item.price}
						</div>
					} else {
						return <fieldset key={id}>
							<legend>{item.name} {_.sum(Object.keys(item.sub).map(sub_id => this.getOrderOf(sub_id)))}</legend>
							{Object.entries(item.sub).map( ([sub_id, sub_item]) =>
								<div key={sub_id}>
									<MenuItem name={sub_item.name}
									          onMinusClick={this.onOrderChanged.bind(this, sub_id, -1)}
									          onPlusClick={this.onOrderChanged.bind(this, sub_id, 1)}
									/>
									{this.getOrderOf(sub_id)}個 単価&yen;{sub_item.price}
								</div>
							)}
						</fieldset>
					}
				}),
				// チケット一覧
				<fieldset>
					<legend>チケット</legend>
					{Object.entries(this.state.tickets).map(([ticket_id, ticket]) =>
						<div key={ticket_id}>
							<MenuItem name={ticket.name}
							          onMinusClick={this.onTicketsChanged.bind(this, ticket_id, -1)}
							          onPlusClick={this.onTicketsChanged.bind(this, ticket_id, 1)}
							/>
							{this.state.usedTickets[ticket_id] || 0}枚
						</div>
					)}
				</fieldset>,
				<div>
					<button onClick={this.submit.bind(this)} className={styles.submit_btn} disabled={!this.submitEnabled()}>注文確定</button>

					<button onClick={this.clearAll.bind(this)} className={styles.cancel_btn}>キャンセル</button>
				</div>

				//TODO 直近の注文表示(あとでおk)
			]
		}
	}

}

render(<CashRegister stallId={location.pathname.split('/')[2]} />,   //htmlのディレクトリからidを取得
	document.getElementById("cash_register"));