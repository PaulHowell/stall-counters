import React from 'react';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSync, faExclamationTriangle} from "@fortawesome/free-solid-svg-icons";

function ErrLoading(props) {
	return <h3><FontAwesomeIcon icon={faExclamationTriangle} color="red" /> Error loading data.
		{props.error && ": "+props.error }</h3>;
}

function Loading() {
	return <h3><FontAwesomeIcon icon={faSync} spin color="green" /> Now Loading&hellip;</h3>;
}

export {ErrLoading, Loading}