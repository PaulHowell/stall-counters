import React from 'react';
import styled from "styled-components";

const BtnFlatStripe = styled.div`
	position: relative;
    display: inline-block;
    font-weight: bold;
    font-size: xx-large;
    padding: 0.5em 1em;
    text-decoration: none;
    border-left: solid 4px ${props => props.color_main};
    border-right: solid 4px ${props => props.color_main};
    color: ${props => props.color_main};
    text-shadow: 0 0 5px white;
    background: repeating-linear-gradient(-45deg, ${props => props.color_lighter}, ${props => props.color_lighter} 3px,${props => props.color_whitest} 3px, ${props => props.color_whitest} 7px);
    transition: .4s;
    &:hover {
    	background: repeating-linear-gradient(-45deg, ${props => props.color_lighter}, ${props => props.color_lighter} 5px,${props => props.color_whitest} 5px, ${props => props.color_whitest} 9px);
    }
`;

function StallListItem(props) {

	let linkUrl = "/"+props.stallId+"/index.html";

	let colorMain = props.stall.color_main;
	let colorLighter = props.stall.color_lighter;
	let colorWhitest = props.stall.color_whitest;

	return (
		<BtnFlatStripe as="a" href={linkUrl} color_main={colorMain} color_lighter={colorLighter} color_whitest={colorWhitest}>{props.stall.name}</BtnFlatStripe>
	)

}

export default StallListItem;