import React from 'react';
import {render} from 'react-dom';
import * as firebase from "firebase/app";
import "firebase/firestore";
import {Loading, ErrLoading} from "./Loading";
import StallListItem from "./StallListItem";
import ebStyles from "./EventBar.css";
import fbinitAnd from "./fbinit";

function EventBar(props) {
	let name = props.name;
	let begin = props.begin.toDate();
	let end = props.end.toDate();
	let defOpt = { year: 'numeric', month: 'numeric', day: 'numeric' };
	let jaJP = 'ja-JP';
	let datesStr = begin.toLocaleString(jaJP, defOpt);
	if (begin.getFullYear()!==end.getFullYear()){
		datesStr +=  "〜" + end.toLocaleString(jaJP, defOpt);
	}else if (begin.getMonth()!==end.getMonth()){
		let opt = { month: 'numeric', day: 'numeric' };
		datesStr += "〜" + end.toLocaleString(jaJP, opt);
	}else if (begin.getDate()!==end.getDate()){
		datesStr += "〜" + end.getDate();
	}

	return(
		<h3 className={ebStyles.eventBar}>{name} ({datesStr})</h3>
	)
}

class StallList extends React.Component{
	constructor(props){
		super(props);
		this.state = {
			loading: true,
			events: null,
			stalls: null,
			error: false
		}
	}

	componentDidMount() {
		try {
			fbinitAnd(() => this.loadData());
		}catch {
			console.log(error);
			this.setState({ loading:false, error:true });
		}
	}

	loadData(){
		Promise.all([
			firebase.firestore().collection('events').get(),
			firebase.firestore().collection('stalls').get()
		]).then(response => {
			this.setState({
				loading:false,
				events: response[0].docs,
				stalls: response[1].docs
			})
		}).catch((error) => {
			console.log(error);
			this.setState({ loading:false, error:true });
		});
	}

	render() {
		if (this.state.error) {
			return <ErrLoading/>;
		} else if (this.state.loading) {
			return <Loading/>;
		} else {
			return this.state.events.map(event =>
				<section>
					<EventBar key={event.id} name={event.get('name')} begin={event.get('begin')} end={event.get('end')}/>
					{this.state.stalls
						.filter(s => s.get('event') === event.id)
						.map(stall => <StallListItem key={stall.id} stall={stall.data()} event={event.data()} stallId={stall.id} />)
					}
				</section>
			);
		}
	}
}

render(<StallList />, document.getElementById('stall_list'));
