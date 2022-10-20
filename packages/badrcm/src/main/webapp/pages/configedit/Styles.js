import styled from 'styled-components';
import { variables, mixins } from '@splunk/themes';

const StyledContainer = styled.div`
    ${mixins.reset('inline')};
    display: block;
    font-size: ${variables.fontSizeLarge};
    line-height: 200%;
    margin: calc(${variables.spacing}) calc(${variables.spacing});
`;

const StanzaSpan = styled.span`
    font-weight:bold;
    color: #E00000;
`;

const AttributeSpan = styled.span`
    color: #863B00;
`;


export { StyledContainer, StanzaSpan, AttributeSpan};