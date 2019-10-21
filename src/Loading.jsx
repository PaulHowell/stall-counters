import React from 'react';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSync, faExclamationTriangle} from "@fortawesome/free-solid-svg-icons";

function ErrLoading(props) {
	let contents = [<h2><FontAwesomeIcon icon={faExclamationTriangle} color="red" /> Error loading data.</h2>];
	if (props.error){
		contents.push(<ul>
			{props.error.map(err => {
				if (typeof err != "string") {
					if (err.code) return <li>{err.code}: {err.message}</li>;
					else return <li>{err.message}</li>;
				}
				else return <li>{err}</li>
			})}
		</ul>)
	}
	return contents;
}

function Loading() {
	return <h3><FontAwesomeIcon icon={faSync} spin color="green" /> Now Loading&hellip;</h3>;
}

export {ErrLoading, Loading}