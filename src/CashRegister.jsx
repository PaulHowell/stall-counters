import React from 'react';
import {render} from 'react-dom';
import _ from "lodash";
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import {ErrLoading, Loading} from "./Loading";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlusCircle, faMinusCircle, faHourglassHalf} from "@fortawesome/free-solid-svg-icons";
import fbinitAnd from "./fbinit";
import styles from "./CashRegister.css";
import * as moment from "moment-timezone";

moment.locale('ja-JP');
const tokyo = 'Asia/Tokyo';

function MenuItem(props){
	return <span>
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
			set: null,
			order: {},
			usedTickets: {},
			submitting: false,
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
		let set = docSS.get("set");
		this.setState({ menu: menu, tickets: tickets, set: set, loading: false });
	}

	loadingError(error) {
		console.error(error);
		this.setState({ loading: false, error: this.state.error.concat(error) });
	}

	// 合計金額計算
	calculate(){
		if (!this.chkTickets()) return "チケットが注文数より多い";
		let discount = _.sum(Object.entries(this.state.usedTickets).map(([ticketId, cnt]) => this.state.tickets[ticketId].discount * cnt));
		let raw_price = _.sum(Object.entries(this.state.order).map(([id, cnt]) => this.price(id)*cnt));
		if(this.chkSet(this.state.order)){
			let ord = Object.assign({}, this.state.order);
			let set_price = 0;
			do {
				set_price += this.state.set.price;
				this.state.set.contents.forEach( map => {
					let c = map.cnt;
					for (let item of map.items){
						if(ord[item]){
							let tmp = Math.min(ord[item], c);
							ord[item] -= tmp;
							c -= tmp;
						}
						if(c<=0) break;
					}
				});
			} while (this.chkSet(ord));
			set_price += _.sum(Object.entries(ord).map(([id, cnt]) => this.price(id)*cnt));
			return Math.min(raw_price, set_price) - discount;
		}else return raw_price - discount;
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

	chkSet(ord){
		if (!this.state.set) return false;
		return this.state.set.contents.every( map =>
			_.sum(map.items.map(item => (ord[item] || 0))) >= map.cnt
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
		this.setState({ submitting: true });
		let total_price = this.calculate();
		let order = this.state.order;
		let usedTickets = this.state.usedTickets;

		firebase.firestore().runTransaction(async transaction => {
			const stallData = await transaction.get(this.state.stallRef);
			const sales = stallData.get("sales");
			let cntToday = sales.cntToday;
			let yenToday = sales.yenToday;
			let cntTot = sales.cntTot;
			const lastIdx = stallData.get("last_index");
			if (!moment(sales.today.toDate()).tz(tokyo).isSame(moment(), 'day')){
				//today関連の更新も同時に
				cntToday = {};
				Object.keys(sales.cntToday).forEach(key => {
					cntToday[key] = 0;
				});
				yenToday = 0;
				transaction.update(this.state.stallRef,{ "sales.today": firebase.firestore.FieldValue.serverTimestamp() })
			}
			for (let [item, cnt] of Object.entries(order)){
				cntToday[item] += cnt;
				cntTot[item] += cnt;
			}
			transaction.update(this.state.stallRef, {
				"sales.yenToday": yenToday + total_price,
				"sales.cntToday": cntToday,
				"sales.yenTot": firebase.firestore.FieldValue.increment(total_price),
				"sales.cntTot": cntTot,
				"last_index": firebase.firestore.FieldValue.increment(1),
			});
			//注文内容をリストに追加
			transaction.set(this.state.salesTableRef.doc(), {
				timestamp: firebase.firestore.FieldValue.serverTimestamp(),
				staff: firebase.auth().currentUser.uid,
				order: order,
				tickets: usedTickets,
				total_price: total_price,
				index: lastIdx + 1,
				served: false,
			});
		}).then(() => {
			this.setState({ submitting: false });
			this.clearAll();
		}).catch(error => {
			console.error(error);
			window.alert("エラー\n"+error);
		});
	}

	submitEnabled(){
		if (this.state.submitting) return false;
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
				<h2 className={styles.cash_disp}>合計: &yen;{this.calculate()}</h2>,
				// メニュー一覧
				Object.entries(this.state.menu).map( ([id, item]) => {
					if (item.price) {
						return <div key={id} className={styles.mt_item}>
							<MenuItem name={item.name}
						                 onMinusClick={this.onOrderChanged.bind(this, id, -1)}
						                 onPlusClick={this.onOrderChanged.bind(this, id, 1)} />
							{this.getOrderOf(id)}個 (単価&yen;{item.price})
						</div>
					} else {
						return <fieldset key={id}>
							<legend>{item.name} {_.sum(Object.keys(item.sub).map(sub_id => this.getOrderOf(sub_id)))}個</legend>
							{Object.entries(item.sub).map( ([sub_id, sub_item]) =>
								<div key={sub_id} className={styles.mt_item}>
									<MenuItem name={sub_item.name}
									          onMinusClick={this.onOrderChanged.bind(this, sub_id, -1)}
									          onPlusClick={this.onOrderChanged.bind(this, sub_id, 1)}
									/>
									{this.getOrderOf(sub_id)}個 (単価&yen;{sub_item.price})
								</div>
							)}
						</fieldset>
					}
				}),
				// チケット一覧
				<fieldset>
					<legend>チケット</legend>
					{Object.entries(this.state.tickets).map(([ticket_id, ticket]) =>
						<div key={ticket_id} className={styles.mt_item}>
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

					<button onClick={this.clearAll.bind(this)} className={styles.cancel_btn} disabled={this.state.submitting}>キャンセル</button>
					{(this.state.submitting) && <div><FontAwesomeIcon icon={faHourglassHalf} color="orange" /> 処理中...</div>}
				</div>,
				//TODO 直近の注文表示(あとでおk)
			]
		}
	}

}

render(<CashRegister stallId={location.pathname.split('/')[2]} />,   //htmlのディレクトリからidを取得
	document.getElementById("cash_register"));
